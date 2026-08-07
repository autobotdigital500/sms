import { createServerFn } from '@tanstack/react-start';

export const bulkSendSmsFn = createServerFn({ method: 'POST' })
  .validator((data: { to: string[]; message: string }) => data)
  .handler(async ({ data }) => {
    const { to, message } = data;

    if (!to || to.length === 0 || !message) {
      throw new Error('Destinatários e mensagem são obrigatórios.');
    }

    const ZERNIO_API_TOKEN = process.env['ZERNIO_API_TOKEN'];
    if (!ZERNIO_API_TOKEN) {
      throw new Error('ZERNIO_API_TOKEN não está configurado no servidor.');
    }

    const ZERNIO_SENDER_ID = process.env['ZERNIO_SENDER_ID'] || 'Autobot';

    const cleanMessage = message.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    const results = {
      success: 0,
      failed: 0,
      errors: [] as { phone: string, error: string }[]
    };

    const chunkSize = 5;
    for (let i = 0; i < to.length; i += chunkSize) {
      const chunk = to.slice(i, i + chunkSize);
      
      const promises = chunk.map(async (phone) => {
        try {
          const response = await fetch('https://api.zernio.com/v1/sms/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json; charset=utf-8',
              'Authorization': `Bearer ${ZERNIO_API_TOKEN}`
            },
            body: JSON.stringify({
              from: ZERNIO_SENDER_ID,
              to: phone.replace(/\D/g, ''),
              text: cleanMessage
            })
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            results.failed++;
            results.errors.push({ phone, error: errorData.message || 'Erro na API' });
          } else {
            results.success++;
          }
        } catch (err: any) {
          results.failed++;
          results.errors.push({ phone, error: err.message });
        }
      });

      await Promise.all(promises);
      
      // Pequeno delay entre lotes para respeitar rate limits (500ms)
      if (i + chunkSize < to.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    return { success: true, data: results };
  });
