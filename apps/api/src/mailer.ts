import { Injectable, ServiceUnavailableException } from '@nestjs/common'
import nodemailer from 'nodemailer'
import { emailLogo } from './email-logo'

@Injectable()
export class Mailer {
  private readonly transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST || '127.0.0.1',
    port: Number(process.env.SMTP_PORT || 1025),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 10000,
  })
  constructor() {
    this.transport.use('stream', (mail, done) => {
      const root = mail.message
      const text = root.childNodes.find(node => /^text\/plain\b/i.test(String(node.getHeader('Content-Type') || '')))
      const related = root.childNodes.find(node => /^multipart\/related\b/i.test(String(node.getHeader('Content-Type') || '')))
      if (/^multipart\/alternative\b/i.test(String(root.getHeader('Content-Type') || '')) && text && related) {
        // MailHog confunde type="text/html" com uma parte HTML e só resolve CIDs
        // no primeiro nível. Relacionar as alternativas à imagem evita ambos.
        const parts = [...related.childNodes]
        const html = parts.find(node => /^text\/html\b/i.test(String(node.getHeader('Content-Type') || '')))
        if (html) {
          root.setHeader('Content-Type', 'multipart/related; type="multipart/alternative"')
          const alternatives = root.createChild('multipart/alternative')
          alternatives.appendChild(text)
          alternatives.appendChild(html)
          related.remove()
          for (const part of parts) if (part !== html) root.appendChild(part)
        }
      }
      done()
    })
  }
  async firstAccess(email: string, token: string, invitation?: string) {
    return this.passwordEmail(email, token, false, invitation)
  }
  async passwordReset(email: string, token: string) {
    return this.passwordEmail(email, token, true)
  }
  private async passwordEmail(email: string, token: string, reset: boolean, invitation?: string) {
    const link = new URL('/', process.env.WEB_ORIGIN || 'http://127.0.0.1:9000')
    const params = new URLSearchParams({ [reset ? 'redefinir-senha' : 'primeiro-acesso']: token })
    if (invitation && /^[a-f0-9]{64}$/.test(invitation)) params.set('convite', invitation)
    // Fragment is not sent in HTTP requests or Referer headers.
    link.hash = params.toString()
    const url = link.toString()
    const safeUrl = url.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    const subject = reset ? 'VTT Sonho Jovem — redefinição de senha' : 'VTT Sonho Jovem — defina sua senha de primeiro acesso'
    const heading = reset ? 'Redefina sua senha com segurança.' : 'Boas-vindas à sua próxima aventura.'
    const introduction = reset
      ? 'Recebemos uma solicitação para redefinir a senha da sua conta no VTT Sonho Jovem. Para cadastrar uma nova senha, utilize o botão abaixo.'
      : 'Recebemos sua solicitação de cadastro no VTT Sonho Jovem. Para concluir a ativação da sua conta, defina sua senha de acesso pelo botão abaixo.'
    const button = reset ? 'Redefinir minha senha' : 'Definir minha senha'
    const validity = reset ? '1 hora' : '48 horas (2 dias)'
    const ignore = reset
      ? 'Se você não solicitou a redefinição, desconsidere esta mensagem. Sua senha atual permanece válida enquanto uma nova senha não for confirmada.'
      : 'Se você não solicitou este cadastro, desconsidere esta mensagem.'
    try {
      const result = await this.transport.sendMail({
        from: process.env.SMTP_FROM || 'VTT Sonho Jovem <nao-responda@vtt.local>',
        to: email,
        subject,
        text: `${heading}\n\nOlá,\n\n${introduction}\n${url}\n\nO link é de uso único e permanece válido por ${validity}. Caso solicite um novo e-mail, somente o link mais recente poderá ser utilizado.\n\n${ignore}\n\nAtenciosamente,\nEquipe VTT Sonho Jovem\n\nEsta é uma mensagem automática. Por favor, não responda a este e-mail.`,
        html: `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${reset ? 'Redefina sua senha' : 'Ative sua conta'} — VTT Sonho Jovem</title></head>
<body style="margin:0;padding:0;background-color:#f2f0f6;font-family:Arial,Helvetica,sans-serif;color:#302a3b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f2f0f6;"><tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background-color:#ffffff;border:1px solid #e4deed;border-radius:16px;overflow:hidden;">
      <tr><td align="center" style="padding:28px 24px;background-color:#1a1922;">
        <img src="cid:vtt-logo" width="64" height="64" alt="Logo VTT Sonho Jovem" style="display:block;border:0;margin:0 auto 12px;">
        <p style="margin:0;color:#f4effc;font-size:20px;font-weight:bold;letter-spacing:2px;">VTT SONHO JOVEM</p>
        <p style="margin:10px 0 0;color:#c8b1eb;font-size:11px;letter-spacing:2px;">IMAGINE. REÚNA. JOGUE.</p>
      </td></tr>
      <tr><td style="padding:32px 24px;font-size:15px;line-height:1.7;">
        <h1 style="margin:0 0 20px;font-size:25px;line-height:1.3;color:#30233f;">${heading}</h1>
        <p style="margin:0 0 16px;">Olá,</p>
        <p style="margin:0 0 24px;">${introduction}</p>
        <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 auto 24px;"><tr><td align="center" bgcolor="#ad87e6" style="border-radius:8px;"><a href="${safeUrl}" style="display:inline-block;padding:15px 28px;color:#21152f;font-size:15px;font-weight:bold;text-decoration:none;">${button}</a></td></tr></table>
        <p style="margin:0 0 24px;padding:16px;background-color:#f4effb;border-left:3px solid #ad87e6;font-size:14px;">Este link é de <strong>uso único</strong> e permanece válido por <strong>${validity}</strong>. Caso solicite um novo e-mail, somente o link mais recente poderá ser utilizado.</p>
        <p style="margin:0 0 12px;font-size:13px;color:#655b70;">Se o botão não funcionar, copie e cole este endereço no seu navegador:</p>
        <p style="margin:0 0 24px;font-size:12px;word-break:break-all;overflow-wrap:anywhere;"><a href="${safeUrl}" style="color:#69419c;">${safeUrl}</a></p>
        <p style="margin:0 0 24px;font-size:13px;color:#655b70;">${ignore}</p>
        <p style="margin:0;">Atenciosamente,<br><strong>Equipe VTT Sonho Jovem</strong></p>
      </td></tr>
      <tr><td align="center" style="padding:20px 24px;border-top:1px solid #ece7f2;color:#766b82;font-size:12px;line-height:1.6;">Um lugar para todas as suas histórias.<br>Esta é uma mensagem automática. Por favor, não responda a este e-mail.</td></tr>
    </table>
  </td></tr></table>
</body></html>`,
        attachments: [{ filename: 'vtt-sonho-jovem.png', content: emailLogo, contentType: 'image/png', cid: 'vtt-logo', contentDisposition: 'inline' }],
      })
      if (!result.accepted?.length) throw new Error('Destinatário não aceito')
    } catch {
      throw new ServiceUnavailableException('Não foi possível enviar o e-mail. Tente novamente em instantes.')
    }
  }
}
