import * as nodemailer from 'nodemailer'
import getParameterValue from '../functions/get-parameter-value'

export class Mailer {
  constructor () {
    this.nodeMailer = nodemailer
  }

  /**
   * Funcion encargada de crear una cuenta random
   *
   * @returns {Promise}
   * @memberof Mailer
   */
  createAccount () {
    return new Promise((resolve, reject) => {
      this.nodeMailer.createTestAccount((err, account) => {
        if (err) return reject(err)
        return resolve(account)
      })
    })
  }

  /**
   * Funcion encargada de crear el transporter para enviar el correo
   *
   * @returns {Promise}
   * @memberof Mailer
   */
  createTransporter () {
    return new Promise(async (resolve, reject) => {
      try {
        const transporter = this.nodeMailer.createTransport({
          host: process.env.SMTP_HOST,
          port: process.env.SMTP_PORT,
          secure: false,
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PW
          }
        })
        resolve(transporter)
      } catch (error) {
        reject(error)
      }
    })
  }

  /**
   * Funcion Encargada de enviar email
   *
   * @param {Array} emails arreglo de emails
   * @param {string} stringHtml conteneido del correo
   * @param {string} [subject=''] asunto del correo
   * @param {string} [text='']
   * @param {Array} [attachments=[]] arreglo de adjuntos
   * @returns {Promise}
   * @memberof Mailer
   */
  sendMail (emails, stringHtml, subject = '', text = '', attachments = []) {
    return new Promise(async (resolve, reject) => {
      // Obtengo el email para colocarlo como remitente
      const nameP = 'EMAIL_USER'
      let fromEmail = null
      try {
        fromEmail = await getParameterValue(nameP)
      } catch (error) {
        return reject(error)
      }

      let transporter = null
      try {
        transporter = await this.createTransporter()
      } catch (error) {
        return reject(error)
      }
      const mailOptions = {
        from: fromEmail,
        to: emails.toString(),
        subject,
        text,
        html: stringHtml,
        attachments
      }
      transporter.sendMail(mailOptions, (err, info) => {
        if (err) return reject(err)
        console.log('Message sent: %s', info.messageId)
        return resolve(info)
      })
    })
  }
}
