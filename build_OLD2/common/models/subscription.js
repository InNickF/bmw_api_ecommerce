import { generateHtmlByEmailtemplate } from '../../server/functions/generate-html-by-email-template'
import { Mailer } from '../../server/services/mailer'
import { userSubscription } from '../../integrations/mail/index';

module.exports = function (Subscription) {
  const subscriptionParam = Subscription
  subscriptionParam.validatesPresenceOf('email', {
    message: {
      labels: 'El campo email es requerido',
      field: 'The email is required'
    }
  })
  subscriptionParam.validatesUniquenessOf('email', {
    message: {
      labels: 'El email ya existe',
      field: 'The email already exists'
    }
  })
  subscriptionParam.validatesPresenceOf('state', {
    message: {
      labels: 'El campo estado es requerido',
      field: 'The state is required'
    }
  })
  subscriptionParam.observe('after save', async (ctx, next) => {
    const {
      MyUser
    } = Subscription.app.models

    // Busca un usuario que tenga el mismo email del suscriptor
    if (ctx.isNewInstance) {
      let userInstance = null
      try {
        userInstance = await MyUser.findOne({
          'where': {
            'email': ctx.instance.email
          }
        })
      } catch (error) {
        throw error
      }

      let exists = false
      if (userInstance) {
        ctx.instance.userId = userInstance.id
        exists = true
      }

      const parametersEmail = {
        email: ctx.instance.email,
        user: userInstance || null,
        exists: exists
      }

      /* const html = generateHtmlByEmailtemplate('subscription-succes', parametersEmail) */

      // send the email
      /* const mailerObject = new Mailer() */
      try {
        const eventName = (brandId) => {
          switch (brandId) {
            case 1:
              return 'autorespuesta_motorrad_10_suscripcion'

            case 2:
              return 'autorespuesta_mini_10_suscripcion'

            case 3:
              return 'autorespuesta_bmw_10_suscripcion'
          }
        }
        await userSubscription(
          {
            "email": ctx.instance.email,
            "eventName": eventName(ctx.instance.brandId),
            "attributes": {
              "email": ctx.instance.email
            }
          }
        )
        console.log("se seuscribio esta si es")
        /* await mailerObject.sendMail([userInstance.email], html, 'Tu suscripción esta completa!') */
      } catch (error) {
        throw error
      }
    }

    return
  })
}
