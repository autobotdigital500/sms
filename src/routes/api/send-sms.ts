import { createServerFn } from '@tanstack/react-start';
import { createClient } from '@supabase/supabase-js';

export const sendSmsFn = createServerFn({ method: 'POST' })
  .validator((data: { to: string; message: string; token: string }) => data)
  .handler(async ({ data }) => {
    const { to, message, token } = data;

    if (!to || !message) {
      throw new Error('Destinatário e mensagem são obrigatórios.');
    }

    const ZERNIO_API_TOKEN = process.env['ZERNIO_API_TOKEN'];
    const SUPABASE_URL = process.env['VITE_SUPABASE_URL'] || process.env['SUPABASE_URL'];
    const SUPABASE_ANON_KEY = process.env['VITE_SUPABASE_ANON_KEY'] || process.env['SUPABASE_ANON_KEY'];

    if (!ZERNIO_API_TOKEN || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error('Variáveis de ambiente não configuradas no servidor.');
    }

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

    const ZERNIO_SENDER_ID = process.env['ZERNIO_SENDER_ID'] || 'Autobot';

    const cleanMessage = message.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    const response = await fetch('https://api.zernio.com/v1/sms/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Authorization': `Bearer ${ZERNIO_API_TOKEN}`
      },
      body: JSON.stringify({
        from: ZERNIO_SENDER_ID,
        to: to.replace(/\D/g, ''), // Limpa a máscara (se necessário enviar código do país, adicione o + aqui)
        text: cleanMessage
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Erro na API da Zernio:', errorData);
      throw new Error('Falha ao enviar SMS pela Zernio.');
    }

    // Deduct credit securely via RPC
    const { data: deductResult, error: deductError } = await supabaseWithAuth.rpc('deduct_credit', { amount: 1 });
    
    if (deductError || !deductResult) {
      console.error('Falha ao deduzir crédito', deductError);
      // We don't throw error here to not fail the frontend if the SMS was already sent, 
      // but ideally we should deduct BEFORE sending, or handle rollback.
    }

    const result = await response.json();
    return { success: true, data: result };
  });
