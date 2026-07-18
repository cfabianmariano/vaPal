import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      clienteNombre, clienteEmail, choferNombre, transportistaNombre,
      valeNumero, cantidadBuenos, cantidadRecuperar, cantidadScrap,
      cantidadTotal, cantidadAutorizada, cantidadRetiradaAcumulada,
      fichadaEntrada, fichadaSalida, estadiaMinutos,
      estado, firmaNombre,
    } = body

    if (!clienteEmail) {
      return NextResponse.json({ error: 'Sin email de cliente' }, { status: 400 })
    }

    const fecha = new Date(fichadaEntrada).toLocaleDateString('es-AR', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    })
    const horaEntrada = new Date(fichadaEntrada).toLocaleTimeString('es-AR', {
      hour: '2-digit', minute: '2-digit'
    })
    const horaSalida = fichadaSalida
      ? new Date(fichadaSalida).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
      : '—'

    const saldoPendiente = cantidadAutorizada - cantidadRetiradaAcumulada
    const esNoConformado = estado === 'no_conformado'

    const firmaRow = firmaNombre
      ? '<tr style="border-bottom: 1px solid #e0e0e0;"><td style="padding: 10px 0; color: #4E5C68;">Firmado por</td><td style="padding: 10px 0; text-align: right; font-weight: 600;">' + firmaNombre + '</td></tr>'
      : ''

    const alertaNoConf = esNoConformado
      ? '<br><span style="color: #C55A2F; font-weight: 600;">⚠ Este retiro no fue conformado con firma.</span>'
      : ''

    const htmlEmail = [
      '<div style="font-family: Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1E2A38;">',
      '  <div style="background: #2E4A63; padding: 24px 32px; border-radius: 6px 6px 0 0;">',
      '    <h1 style="margin: 0; color: #fff; font-size: 22px; font-weight: 600;">VaPal</h1>',
      '    <p style="margin: 4px 0 0; color: #B8C4CE; font-size: 13px;">Comprobante de retiro de pallets</p>',
      '  </div>',
      '  <div style="background: #f8f9fa; padding: 32px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 6px 6px;">',
      '    <p style="font-size: 15px; margin: 0 0 24px;">Estimado/a <strong>' + clienteNombre + '</strong>,</p>',
      '    <p style="font-size: 14px; color: #4E5C68; margin: 0 0 24px; line-height: 1.6;">',
      '      Le informamos que el día <strong>' + fecha + '</strong> se realizó un retiro de pallets en su establecimiento.' + alertaNoConf,
      '    </p>',
      '    <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-bottom: 24px;">',
      '      <tr style="border-bottom: 1px solid #e0e0e0;"><td style="padding: 10px 0; color: #4E5C68;">Vale</td><td style="padding: 10px 0; text-align: right; font-weight: 600;">' + valeNumero + '</td></tr>',
      '      <tr style="border-bottom: 1px solid #e0e0e0;"><td style="padding: 10px 0; color: #4E5C68;">Transportista</td><td style="padding: 10px 0; text-align: right; font-weight: 600;">' + transportistaNombre + '</td></tr>',
      '      <tr style="border-bottom: 1px solid #e0e0e0;"><td style="padding: 10px 0; color: #4E5C68;">Chofer</td><td style="padding: 10px 0; text-align: right; font-weight: 600;">' + choferNombre + '</td></tr>',
      '      <tr style="border-bottom: 1px solid #e0e0e0;"><td style="padding: 10px 0; color: #4E5C68;">Llegada</td><td style="padding: 10px 0; text-align: right;">' + horaEntrada + '</td></tr>',
      '      <tr style="border-bottom: 1px solid #e0e0e0;"><td style="padding: 10px 0; color: #4E5C68;">Salida</td><td style="padding: 10px 0; text-align: right;">' + horaSalida + '</td></tr>',
      '      <tr style="border-bottom: 1px solid #e0e0e0;"><td style="padding: 10px 0; color: #4E5C68;">Estadía</td><td style="padding: 10px 0; text-align: right;">' + (estadiaMinutos ?? '—') + ' min</td></tr>',
      '      ' + firmaRow,
      '    </table>',
      '    <div style="background: #fff; border: 1px solid #e0e0e0; border-radius: 4px; padding: 20px; margin-bottom: 24px;">',
      '      <p style="margin: 0 0 12px; font-size: 13px; color: #4E5C68; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">Detalle del retiro</p>',
      '      <table style="width: 100%; font-size: 14px; border-collapse: collapse;">',
      '        <tr><td style="padding: 6px 0; color: #5D7040;">✓ Buenos</td><td style="padding: 6px 0; text-align: right; font-weight: 600;">' + cantidadBuenos + '</td></tr>',
      '        <tr><td style="padding: 6px 0; color: #C99031;">↻ A recuperar</td><td style="padding: 6px 0; text-align: right; font-weight: 600;">' + cantidadRecuperar + '</td></tr>',
      '        <tr><td style="padding: 6px 0; color: #999;">✕ Scrap</td><td style="padding: 6px 0; text-align: right; font-weight: 600;">' + cantidadScrap + '</td></tr>',
      '        <tr style="border-top: 2px solid #2E4A63;"><td style="padding: 10px 0; font-weight: 700; font-size: 15px;">Total retirado</td><td style="padding: 10px 0; text-align: right; font-weight: 700; font-size: 15px; color: #2E4A63;">' + cantidadTotal + '</td></tr>',
      '      </table>',
      '    </div>',
      '    <div style="background: #2E4A63; color: #fff; border-radius: 4px; padding: 16px 20px; text-align: center; margin-bottom: 24px;">',
      '      <p style="margin: 0; font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: #B8C4CE;">Saldo pendiente de retiro</p>',
      '      <p style="margin: 6px 0 0; font-size: 28px; font-weight: 700;">' + saldoPendiente + '</p>',
      '      <p style="margin: 2px 0 0; font-size: 12px; color: #B8C4CE;">pallets</p>',
      '    </div>',
      '    <p style="font-size: 12px; color: #999; line-height: 1.5; margin: 0;">',
      '      Este comprobante fue generado automáticamente por VaPal. Si tiene consultas, comuníquese con su proveedor.',
      '    </p>',
      '  </div>',
      '</div>',
    ].join('\n')

    const { data, error } = await resend.emails.send({
      from: 'VaPal <onboarding@resend.dev>',
      to: clienteEmail,
      subject: 'Comprobante de retiro — ' + valeNumero + ' — ' + cantidadTotal + ' pallets',
      html: htmlEmail,
    })

    if (error) {
      console.error('Resend error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, emailId: data?.id })
  } catch (err: unknown) {
    console.error('Email error:', err)
    const message = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
