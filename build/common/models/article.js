import slug from 'slug'
import integrationMail from '../../integrations/mail/'
import * as Util from '../../server/utils'
import path from 'path'
import {uploadFile} from '../../server/functions/upload-file'

const idAdmin = process.env.ID_ADMIN

module.exports = function (Article) {
  const articleParam = Article

  articleParam.observe('before save', async (ctx, next) => {
    const {
      AssignedRole
    } = Article.app.models

    if (ctx.isNewInstance) {
      ctx.instance.slug = slug(ctx.instance.name.toLowerCase())

      let assignedRolesInstance = null

      try {
        assignedRolesInstance = await AssignedRole.findOne({
          where: {
            userId: ctx.instance.userId,
            state: true,
            roleId: idAdmin
          }
        })
      } catch (error) {
        throw error
      }

      if (assignedRolesInstance == null) {
        integrationMail.articleMail(ctx.instance)
      }
    }
    next()
  })

  articleParam.validatesPresenceOf('name', {
    message: {
      labels: 'El campo nombre es requerido',
      field: 'The name is required'
    }
  })
  articleParam.validatesPresenceOf('slug', {
    message: {
      labels: 'El campo slug es requerido',
      field: 'The slug is required'
    }
  })
  articleParam.validatesUniquenessOf('slug', {
    message: {
      labels: 'El slug ya existe',
      field: 'The slug already exists'
    }
  })

  articleParam.articlesFilter = async function (body, cb) {
    let articles = null
    try {
      articles = await articleParam.find({
        where: {
          articleCategoryId: body.categoryId
        },
        limit: body.limit ? body.limit : 10
      })
    } catch (error) {
      throw error
    }

    cb(null, articles)
  }

  articleParam.remoteMethod('articlesFilter', {
    accepts: {
      arg: 'data',
      type: 'object',
      description: '{"limit": 3, "categoryId": 2 }'
    },
    returns: {
      arg: 'data',
      type: 'object'
    }
  })

  /**
   * Función para crear la instancia con su respectivo archivo
   *
   * @param {object} req objeto request
   * @returns {object} imageSlider instance
   */
  articleParam.createWithFile = async req => {
    // Obtengo la data del formulario
    let formData
    try {
      formData = await Util.getFormData(req)
    } catch (error) {
      throw error
    }

    // Obtengo campos
    const {fields} = formData
    const obj = {}
    for (const key in fields) {
      obj[key] = fields[key]
    }
    obj.image = '-'

    // Creo la instancia
    let imageArticleInstance = null
    try {
      imageArticleInstance = await articleParam.create(obj)
    } catch (error) {
      throw error
    }

    // Obtengo el file
    const {files} = formData
    let file
    for (const key in files) {
      file = files[key]
    }

    // Valido que tenga el file
    if (file) {
      // Armo la ruta de destino
      const ext = path.extname(file.name)
      const destinationPath = `admin/images/blogs/${imageArticleInstance.id}${ext}`

      // Subo el archivo
      let location
      try {
        location = await uploadFile(file.path, destinationPath)
      } catch (error) {
        throw error
      }

      // Actualizo la instancia
      try {
        await imageArticleInstance.updateAttributes({image: location})
      } catch (error) {
        throw error
      }
    }

    return imageArticleInstance
  }
  articleParam.remoteMethod('createWithFile', {
    description: 'Crea la instancia con su respectivo archivo',
    accepts: {
      arg: 'req',
      type: 'object',
      http: {
        source: 'req'
      }
    }, // pass the request object to remote method
    returns: {root: true, type: 'object'},
    http: {path: '/create-with-file', verb: 'post'}
  })

  articleParam.updateWithFile = async (id, req) => {
    // Busco la instancia
    let imageArticleInstance
    try {
      imageArticleInstance = await articleParam.findById(id)
    } catch (error) {
      throw error
    }

    if (!imageArticleInstance) {
      throw new Error(`No existe la instancia con el id ${id}`)
    }

    // Obtengo la data del formulario
    let formData = null
    try {
      formData = await Util.getFormData(req)
    } catch (error) {
      throw error
    }

    // Obtengo campos
    const {fields} = formData
    const obj = {}
    for (const key in fields) {
      obj[key] = fields[key]
    }

    // Obtengo el file
    const {files} = formData
    let file
    for (const key in files) {
      file = files[key]
    }

    // Valido que tenga el file
    if (file) {
      // Armo la ruta de destino
      const destinationPath = `admin/images/blogs/${imageArticleInstance.id}${file.name}`

      // Subo el archivo
      let location
      try {
        location = await uploadFile(file.path, destinationPath)
      } catch (error) {
        throw error
      }

      obj.image = location
    }

    // Actualizo la instancia
    try {
      await imageArticleInstance.updateAttributes(obj)
    } catch (error) {
      throw error
    }

    return imageArticleInstance
  }
  articleParam.remoteMethod('updateWithFile', {
    description: 'Actualiza la instancia con su respectivo archivo',
    accepts: [
      {
        arg: 'id',
        type: 'number',
        required: true
      }, // id del de la imagen del banner
      {
        arg: 'req',
        type: 'object',
        http: {
          source: 'req'
        }
      } // pass the request object to remote method
    ],
    returns: {root: true, type: 'object'},
    http: {path: '/:id/update-with-file', verb: 'patch'}
  })
}
