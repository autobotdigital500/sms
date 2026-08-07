import { createServerFn } from '@tanstack/react-start';
import { createClient } from '@supabase/supabase-js';

export const sendSmsFn = createServerFn({ method: 'POST' })
  .validator((data: { to: string; message: string; token: string }) => data)
  .handler(async ({ data }) => {
    const { to, message, token } = data;

    if (!to || !message) {
      throw new Error('Destinatário e mensagem são obrigatórios.');
    }

    const apiTokensEnv = process.env['ZERNIO_API_TOKENS'] || process.env['ZERNIO_API_TOKEN'];
    const SUPABASE_URL = process.env['VITE_SUPABASE_URL'] || process.env['SUPABASE_URL'];
    const SUPABASE_ANON_KEY = process.env['VITE_SUPABASE_ANON_KEY'] || process.env['SUPABASE_ANON_KEY'];

    if (!apiTokensEnv || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error('Configuração de API ausente no servidor.');
    }

    const apiTokens = apiTokensEnv.split(',').map(t => t.trim()).filter(Boolean);

    // Create authenticated client
    const supabaseWithAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    // Verify user token
    const { data: { user }, error: authError } = await supabaseWithAuth.auth.getUser(token);
    if (authError || !user) {
      throw new Error('Sessão inválida ou expirada.');
    }

    // Check balance
    const { data: credits, error: creditsError } = await supabaseWithAuth
      .from('user_credits')
      .select('balance')
      .eq('user_id', user.id)
      .single();

    if (creditsError || !credits || credits.balance <= 0) {
      throw new Error('Saldo insuficiente. Por favor, adicione créditos.');
    }

    const senderIdsEnv = process.env['ZERNIO_SENDER_IDS'] || process.env['ZERNIO_SENDER_ID'] || 'Autobot,autobot1,autobot2,autobot3';
    const senderIds = senderIdsEnv.split(',').map(id => id.trim()).filter(Boolean);

    const cleanNumber = to.replace(/\D/g, '');

    // Check opt-outs
    const { data: optOutCheck, error: optOutError } = await supabaseWithAuth
      .from('opt_outs')
      .select('id')
      .eq('user_id', user.id)
      .eq('phone_number', cleanNumber)
      .maybeSingle();

    if (optOutCheck) {
      // Registrar no histórico como bloqueado e abortar envio
      await supabaseWithAuth.from('message_history').insert({
        user_id: user.id,
        to_number: to,
        message: message.normalize('NFD').replace(/[\u0300-\u036f]/g, ''),
        status: 'Bloqueado',
        error_message: 'Número na lista de opt-outs.'
      });
      throw new Error('Número bloqueado por opt-out (Envio cancelado e crédito não cobrado).');
    }

    const cleanMessage = message.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    let response: Response | null = null;
    let sendSuccess = false;
    let errorData = null;
    let invalidNumber = false;

    for (const token of apiTokens) {
      for (const senderId of senderIds) {
        response = await fetch('https://api.zernio.com/v1/sms/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            from: senderId,
            to: cleanNumber, // Limpa a máscara
            text: cleanMessage
          })
        });

        if (response.ok) {
          sendSuccess = true;
          break; // Sucesso! Sai do loop de Sender IDs.
        } else {
          errorData = await response.json().catch(() => ({}));
          console.warn(`Zernio API falhou (Token e Sender: ${senderId}):`, errorData);
          // Se for erro de número inválido (ex: 400), não tentamos os outros, pois o erro é no destinatário.
          if (response.status === 400) {
            invalidNumber = true;
            break; 
          }
          // Se for 403/429 (limite), continua tentando o próximo Sender ID ou Token!
        }
      }
      if (sendSuccess || invalidNumber) break; // Sai do loop de Tokens também
    }

    // Insert history on failure
    if (!sendSuccess) {
      console.error('Falha definitiva na API da Zernio após tentar Sender IDs:', errorData);
      
      await supabaseWithAuth.from('message_history').insert({
        user_id: user.id,
        to_number: to,
        message: cleanMessage,
        status: 'Falha',
        error_message: 'Falha ao enviar SMS pela Zernio (Limites excedidos ou erro na API).'
      });
      
      throw new Error('Falha ao enviar SMS pela Zernio.');
    }

    // Deduct credit securely via RPC
    const { data: deductResult, error: deductError } = await supabaseWithAuth.rpc('deduct_credit', { amount: 1 });
    
    if (deductError || !deductResult) {
      console.error('Falha ao deduzir crédito', deductError);
    }

    // Insert history on success
    await supabaseWithAuth.from('message_history').insert({
      user_id: user.id,
      to_number: to,
      message: cleanMessage,
      status: 'Enviado'
    });

    const result = response ? await response.json() : {};
    return { success: true, data: result };
  });
