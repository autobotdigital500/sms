import { createServerFn } from '@tanstack/react-start';

export const sendSmsFn = createServerFn({ method: 'POST' })
  .validator((data: { to: string; message: string }) => data)
  .handler(async ({ data }) => {
    const { to, message } = data;

    if (!to || !message) {
      throw new Error('Destinatário e mensagem são obrigatórios.');
    }

    const ZERNIO_API_TOKEN = process.env['ZERNIO_API_TOKEN'];

    if (!ZERNIO_API_TOKEN) {
      throw new Error('ZERNIO_API_TOKEN não está configurado no servidor.');
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

    const result = await response.json();
    return { success: true, data: result };
  });
