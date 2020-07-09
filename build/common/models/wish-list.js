
import { generateHtmlByEmailtemplate } from '../../server/functions/generate-html-by-email-template'
import { Mailer } from '../../server/services/mailer'
import * as autogermanaIntegration from '../../integrations/autogermana'
import { wishList } from '../../integrations/mail/index';
import { priceFormatter } from '../../server/utils'

module.exports = function (Wishlist) {
  const wishlistParam = Wishlist

  wishlistParam.observe('after save', async (ctx, next) => {
    const {
      MyUser
    } = Wishlist.app.models

    if (ctx.isNewInstance) {
      let userInstance
      try {
        userInstance = await MyUser.findOne({
          where: {
            id: ctx.instance.userId
          }
        })
      } catch (error) {
        return error
      }

      let wishListInstance
      try {
        wishListInstance = await wishlistParam.find({ where: { userId: ctx.instance.userId } })
      } catch (error) {
        throw error
      }

      const productInstances = []
      for (const product of wishListInstance) {
        let productInstance
        try {
          productInstance = await product.product.get()
        } catch (error) {
          throw error
        }

        // obtengo la image
        let imageInstance = []
        try {
          imageInstance = await productInstance.imageProducts.find()
        } catch (error) {
          throw error
        }
        if (imageInstance.length < 1) {
          productInstance.imageUrl = 'https://autogermana.s3.amazonaws.com/no%20-foto.png'
        } else {
          productInstance.imageUrl = imageInstance[0].image
        }

        let availabilityAutogermana
        try {
          availabilityAutogermana = await autogermanaIntegration.getDetailAvailability(productInstance.sku)
        } catch (error) {
          throw error
        }

        if (await availabilityAutogermana[0].Disponible > 0) {
          try {
            await productInstance.updateAttributes({
              stock: availabilityAutogermana[0].Disponible
            })
          } catch (error) {
            throw error
          }
          productInstances.push(productInstance)
        }
      }

      let url = {}
      try {
        if (ctx.instance.brandId === 1) {
          url.url = 'https://bmwmotorradshop.com.co/lista-de-deseos'
        } else if (ctx.instance.brandId === 2) {
          url.url = 'https://bmwshop.com.co/lista-de-deseos'
        } else if (ctx.instance.brandId === 3) {
          url.url = 'https://minishop.com.co/lista-de-deseos'
        }
      } catch (error) {
        throw error
      }

      const parametersEmail = {
        user: userInstance,
        products: productInstances.length > 3 ? productInstances.slice(productInstances.length - 3, productInstances.length) : productInstances,
        url: url
      }

      const eventName = (brandId) => {
        switch (brandId) {
          case 1:
            return 'autorespuesta_motorrad_6_lista_de_deseos'

          case 2:
            return 'autorespuesta_mini_6_lista_de_deseos'

          case 3:
            return 'autorespuesta_bmw_6_lista_de_deseos'
        }
      }

      const data = {
        email: userInstance.email,
        eventName: eventName(userInstance.brandId),
        attributes: {
          name: userInstance.firstName,
          lastName: userInstance.lastName,
          event_items: productInstances.length > 3 ?
            productInstances.slice(productInstances.length - 3, productInstances.length).
              map((product) => {
                return {
                  productImage: product.imageUrl,
                  productName: product.name.toUpperCase(),
                  productPrice: priceFormatter(product.price)
                }
              })
            :
            productInstances.map((product) => {
              return {
                productImage: product.imageUrl,
                productName: product.name.toUpperCase(),
                productPrice: priceFormatter(product.price)
              }
            })
        }
      }
      console.log(data.attributes.event_items)
      if (productInstances.length > 0) {
        await wishList(data);
      }


      // const html = generateHtmlByEmailtemplate('wish-list', parametersEmail)

      // // send the email
      // const mailerObject = new Mailer()
      // try {
      //   await mailerObject.sendMail([userInstance.email], html, 'Lista de deseos!')
      // } catch (error) {
      //   throw error
      // }
    }
  })

  wishlistParam.validatesPresenceOf('userId', {
    message: {
      labels: 'El campo usuario es requerido',
      field: 'The userId is required'
    }
  })
  wishlistParam.validatesPresenceOf('productId', {
    message: {
      labels: 'El campo producto es requerido',
      field: 'The productId is required'
    }
  })
}
