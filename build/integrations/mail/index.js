const nodemailer = require('nodemailer')
const userMail = process.env.USERMAIL
const passMail = process.env.PASSMAIL

const rp = require('request-promise')
const url = `http://track.embluemail.com/contacts/event`

function request(body, type, ) {
  const options = {
    method: type,
    uri: url,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `MWQ5ZGQ0YmU1NDljNGRjZDlmNDRmMGZlODQ2YjVkMGY=`
    },
    body: body,
    json: true
  }
  return rp(options)
}

function suscriptorMail(body) {
  // create reusable transporter object using the default SMTP transport
  let transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: userMail, // generated ethereal user
      pass: passMail // generated ethereal password
    }
  })

  // setup email data with unicode symbols
  let mailOptions = {}
  if (body.userId !== 0 && body.userId > 0) {
    mailOptions = {
      from: '"Autogermana 👋" <' + userMail + '>', // sender address
      to: body.email, // list of receivers
      subject: '¡Suscripción exitoso!', // Subject line
      text: 'Su suscripción se ha creado correctamente con una cuenta existente.', // plain text body
      html: '<b>Su suscripción se ha creado correctamente con una cuenta existente.</b>' // html body
    }
  } else {
    mailOptions = {
      from: '"Autogermana 👋" <' + userMail + '>', // sender address
      to: body.email, // list of receivers
      subject: '¡Suscripción exitoso!', // Subject line
      text: 'Su suscripción se ha creado correctamente.', // plain text body
      html: '<b>Su suscripción se ha creado correctamente.</b>' // html body
    }
  }

  // send mail with defined transport object
  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      return console.log(error)
    }
    console.log('Message sent: %s', info.messageId)
    // Preview only available when sending through an Ethereal account
    console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info))

    // Message sent: <b658f8ca-6296-ccf4-8306-87d57a0b4321@example.com>
    // Preview URL: https://ethereal.email/message/WaQKMgKddxQDoou...
  })
}

function articleMail(body) {
  // create reusable transporter object using the default SMTP transport
  let transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: userMail,
      pass: passMail
    }
  })

  // setup email data with unicode symbols
  let mailOptions = {}
  if (body.userId !== 0 || body.userId != null) {
    mailOptions = {
      from: '"Autogermana 👋" <' + userMail + '>',
      to: body.email,
      subject: '👋 Nuevo articulo ✔',
      text: 'El nuevo articulo que acabas de crear esta pendiente por aprobacion del administrador!',
      html: '<b>El nuevo articulo que acabas de crear esta pendiente por aprobacion del administrador!</b>'
    }
  }

  // send mail with defined transport object
  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      return console.log(error)
    }
  })
}

function eventAssistantMail(body, user) {
  // create reusable transporter object using the default SMTP transport
  let transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: userMail,
      pass: passMail
    }
  })

  // setup email data with unicode symbols
  let mailOptions = {}
  if (body.userId !== 0 || body.userId != null) {
    mailOptions = {
      from: '"Autogermana 👋" <' + userMail + '>',
      to: body.email,
      subject: '¡Registro exitoso!',
      text: 'Su asistencia se ha registrado correctamente.',
      html: '<b>Su asistencia se ha registrado correctamente.</b>'
    }
  }

  // send mail with defined transport object
  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      return console.log(error)
    }
  })
}

function returnProductMail(body) {
  // create reusable transporter object using the default SMTP transport
  let transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: userMail,
      pass: passMail
    }
  })

  // setup email data with unicode symbols
  let mailOptions = {}
  mailOptions = {
    from: '"Autogermana 👋" <' + userMail + '>',
    to: body.email,
    subject: '👋 Devolución de producto ✔',
    text: 'El nuevo articulo que acabas de crear esta pendiente por aprobacion del administrador!',
    html: '<b>El nuevo articulo que acabas de crear esta pendiente por aprobacion del administrador!</b><br>' + 'Datos del usuario <hr>' + 'numero de: ' + body.order + '<br>' + 'nombre del cliente: ' + body.lastName + '<br>' + 'email del cliente: ' + body.email + '<br>' + 'motivo del cambio: ' + body.reason
  }

  // send mail with defined transport object
  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      return console.log(error)
    }
  })
}

function eventCancel(data) {
  return request(data, 'POST')
}

function eventSucces(data) {
  return request(data, 'POST')
}

function incadeaError(data) {
  return request(data, 'POST')
}

function returnRequest(data) {
  return request(data, 'POST')
}

function requestPqr(data) {
  return request(data, 'POST')
}

function succesPqr(data) {
  return request(data, 'POST')
}

function wishList(data) {
  return request(data, 'POST')
}

function orderSucces(data) {
  return request(data, 'POST')
}

function userSucces(data) {
  return request(data, 'POST')
}

function userSubscription(data) {
  return request(data, 'POST')
}

function form(data) {
  return request(data, 'POST')
}

function abandoned(data) {
  return request(data, 'POST')
}

module.exports = {
  suscriptorMail,
  articleMail,
  eventAssistantMail,
  returnProductMail,
  eventCancel,
  eventSucces,
  incadeaError,
  returnRequest,
  userSubscription,
  requestPqr,
  succesPqr,
  wishList,
  orderSucces,
  form,
  userSucces,
  abandoned
}