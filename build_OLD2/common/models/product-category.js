import slug from 'slug'
import * as Util from '../../server/utils'
import { uploadFile } from '../../server/functions/upload-file'
import * as autogermanaIntegration from '../../integrations/autogermana'
import * as app from '../../server/server'
import { executeSQL } from '../../server/functions/execute-sql'
// const throat = require('throat')

module.exports = function (ProductCategory) {
  const productCategoryParam = ProductCategory

  // hooks
  productCategoryParam.observe('before save', async ctx => {
    if (ctx.isNewInstance) {
      ctx.instance.slug = slug(ctx.instance.name.toLowerCase())
    }
    return Promise.resolve()
  })

  // validaciones
  productCategoryParam.validatesPresenceOf('name', {
    message: 'El campo name es requerido'
  })
  productCategoryParam.validatesPresenceOf('slug', {
    message: 'El campo slug es requerido'
  })
  productCategoryParam.validatesPresenceOf('isMotivator', {
    message: 'El campo isMotivator es requerido'
  })

  productCategoryParam.productFilter = async function (body) {
    let keys = ['slug', 'brandId', 'parentId']
    let missingKeys = Util.getMissinKeys(keys, body)

    // valido
    if (missingKeys.length > 0) {
      throw new Error(`Faltan estos atributos ${missingKeys.toString()}`)
    }

    // encuentro la marca
    const { Brand } = productCategoryParam.app.models
    let brandInstance
    try {
      brandInstance = await Brand.findById(body.brandId)
    } catch (error) {
      throw error
    }

    // valido
    if (!brandInstance) {
      throw new Error(`La marca con el id ${body.brandId}, no existe`)
    }

    // encuentro la categoria
    let categoryInstance = null
    if (body.parentId) {
      try {
        categoryInstance = await productCategoryParam.findOne({
          where: {
            slug: body.slug,
            parentId: body.parentId,
            brandId: brandInstance.id
          }
        })
      } catch (error) {
        throw error
      }
    } else {
      try {
        categoryInstance = await productCategoryParam.findOne({
          where: {
            slug: body.slug,
            brandId: brandInstance.id
          }
        })
      } catch (error) {
        throw error
      }
    }

    // valido
    if (!categoryInstance) {
      throw new Error(
        `La categoria con el slug ${body.slug} y el nivel ${
        body.level
        }, no existe.`
      )
    }

    const categoryIds = []

    if (categoryInstance.level === 3) {
      categoryIds.push(categoryInstance.id)
    } else if (categoryInstance.level === 2) {
      const categoriesLevel3 = await categoryInstance.childrenCategories.find()
      categoryIds.push(categoryInstance.id)
      for (const categoryLevel3 of categoriesLevel3) {
        categoryIds.push(categoryLevel3.id)
      }
    } else if (categoryInstance.level === 1) {
      const categoriesLevel2 = await categoryInstance.childrenCategories.find()
      for (const categoryLevel2 of categoriesLevel2) {
        categoryIds.push(categoryLevel2.id)
        const categoriesLevel3 = await categoryLevel2.childrenCategories.find()
        for (const categoryLevel3 of categoriesLevel3) {
          categoryIds.push(categoryLevel3.id)
        }
      }
    } else {
      throw new Error('Nivel no soportado')
    }

    let whereObj = {
      where: {
        productCategoryId: { inq: categoryIds },
        active: true
      },
      include: [
        {
          relation: 'imageProducts',
          scope: {
            fields: {
              image: true
            }
          }
        },
        {
          relation: 'skuVariations',
          scope: {
            include: [
              {
                relation: 'productChildren'
              }
            ]
          }
        },
        'productCategory',
        'productVariations'
      ],
      limit: body.limit,
      skip: body.skip,
      order: body.order
    }
    if (body.skus && body.skus.length > 0) {
      whereObj.where.sku = { "inq": body.skus }
    } else {
      whereObj.where.isFather = true
    }
    const { Product } = productCategoryParam.app.models
    let productInstances
    try {
      if (body.offer) {
        whereObj.where.endDateDiscount = { "gte": new Date() }
      }
      productInstances = await Product.find(whereObj)
    } catch (error) {
      throw error
    }

    let response = productInstances.map(async (item) => {
      let sizes = [];
      let colors = [];
      let hexArray = []
      await item.skuVariations.find().map(async (itemColor) => {
        /* colors.push(itemColor) */

        if (!colors.includes(itemColor.color)) {
          colors.push(itemColor.color)
        }
        if (!sizes.includes(itemColor.size)) {
          sizes.push(itemColor.size)
        }
        let productChildrent = await itemColor.productChildren.get()
        if (!hexArray.includes(productChildrent.hex)) {
          hexArray.push(productChildrent.hex)
        }
      })

      const product = item
      product.colors = await colors
      product.sizes = await sizes
      product.hexArray = await hexArray
      return product
    })
    const res = await Promise.all(response)
    return res
  }
  productCategoryParam.remoteMethod('productFilter', {
    accepts: {
      arg: 'data',
      type: 'object',
      description: `{"slug": "Accesorios", "level": 3,
      "limit": 100, "skip": 1, "order": "price, name, createdAt DESC || ASC" }`
    },
    returns: {
      arg: 'data',
      root: true,
      type: 'Object'
    }
  })

  // Ver la lista de todos los productos
  productCategoryParam.findCategoryParents = async body => {
    let category = null
    try {
      category = await productCategoryParam.findById(body.id)
    } catch (error) {
      throw error
    }

    if (!category) {
      throw new Error('La categoria no existe')
    }
    if (category.parentId) {
      let categoryParent = null
      try {
        categoryParent = await productCategoryParam.find({
          where: {
            id: category.parentId
          }
        })
      } catch (error) {
        throw error
      }
      category.parent = categoryParent[0]

      if (!categoryParent) {
        throw new Error('La categoria no existe')
      }
      if (categoryParent[0].parentId) {
        let categoryFarthert = null
        try {
          categoryFarthert = await productCategoryParam.find({
            where: {
              id: categoryParent[0].parentId
            }
          })
        } catch (error) {
          throw error
        }
        category.parent.parent = categoryFarthert[0]
      }
    }
    return category
  }
  productCategoryParam.remoteMethod('findCategoryParents', {
    accepts: {
      arg: 'body',
      type: 'Object',
      require: true,
      description: '{ id: 0 }'
    },
    http: {
      verb: 'post',
      path: '/findCategoryParents'
    },
    returns: {
      arg: 'data',
      type: 'Object'
    }
  })

  productCategoryParam.handleCategoriesAutogermana = async () => {
    let categories
    try {
      categories = await autogermanaIntegration.getCategories()
    } catch (error) {
      throw error
    }

    const { Brand } = productCategoryParam.app.models

    const handleCategoryCreation = async categoryObject => {
      // encuentro o creo la categoria
      let categoryResult
      try {
        const isRootCategory = categoryObject.parentId === null || categoryObject.parentId === 0
        const condition = {
          name: categoryObject.name,
          level: categoryObject.level,
          brandId: categoryObject.brandId,
          [isRootCategory ? 'isMotivator' : 'parentId']:
            isRootCategory || categoryObject.parentId
        }
        categoryResult = await productCategoryParam.findOrCreate(
          { where: condition },
          categoryObject
        )
      } catch (error) {
        throw error
      }

      // asigno el valor a la instancia
      const categoryInstance = categoryResult[0]

      return categoryInstance
    }

    //
    const errors = []
    let processed = 0
    for (const category of categories) {
      // valido
      if (!category.marca) {
        errors.push('La marca es nula')
        continue
      }

      // obtengo la marca
      let brandInstance
      try {
        brandInstance = await Brand.findOne({
          where: { code: category.marca.trim() }
        })
      } catch (error) {
        errors.push(error.message)
        continue
      }

      // valido
      if (!brandInstance) {
        errors.push(`La marca con el codigo ${category.marca}, no existe`)
        continue
      }

      // defino el objeto para la categoria de nivel 1
      const categoryLevel1Object = {
        name: category.grupo,
        slug: slug(category.grupo.toLowerCase()),
        isMotivator: true,
        level: 1,
        brandId: brandInstance.id,
        parentId: null
      }

      // creo la categoria
      let categoryLevel1Instance
      try {
        categoryLevel1Instance = await handleCategoryCreation(
          categoryLevel1Object
        )
      } catch (error) {
        errors.push(error.message)
        continue
      }

      // defino el objeto para la categoria de nivel 2
      const categoryLevel2Object = {
        name: category.categoria,
        slug: slug(category.categoria.toLowerCase()),
        isMotivator: false,
        level: 2,
        brandId: brandInstance.id,
        parentId: categoryLevel1Instance.id
      }

      // creo la categoria
      let categoryLevel2Instance
      try {
        categoryLevel2Instance = await handleCategoryCreation(
          categoryLevel2Object
        )
      } catch (error) {
        errors.push(error.message)
        continue
      }

      // defino el objeto para la categoria de nivel 3
      const categoryLevel3Object = {
        name: category.subcategoria,
        slug: slug(category.subcategoria.toLowerCase()),
        isMotivator: false,
        level: 3,
        brandId: brandInstance.id,
        parentId: categoryLevel2Instance.id
      }

      // creo la categoria
      try {
        await handleCategoryCreation(categoryLevel3Object)
      } catch (error) {
        errors.push(error.message)
        continue
      }
      processed += 1
    }

    return {
      processed,
      errors
    }
  }
  productCategoryParam.remoteMethod('handleCategoriesAutogermana', {
    http: {
      verb: 'post',
      path: '/handle-categories-autogermana'
    },
    returns: {
      arg: 'data',
      type: 'Object',
      root: true
    }
  })
  /**
   * Función para crear la instancia con su respectivo archivo
   *
   * @param {object} req objeto request
   * @returns {object} imageSlider instance
   */
  productCategoryParam.createWithFile = async req => {
    // Obtengo la data del formulario
    let formData
    try {
      formData = await Util.getFormData(req)
    } catch (error) {
      throw error
    }

    // Obtengo campos
    const { fields } = formData
    const obj = {}
    for (const key in fields) {
      obj[key] = fields[key]
    }
    obj.image = '-'
    obj.cover = '-'

    // Creo la instancia
    let imageProductCategoryInstance = null
    try {
      imageProductCategoryInstance = await productCategoryParam.create(obj)
    } catch (error) {
      throw error
    }

    // Obtengo el file
    const { files } = formData
    let file = {}
    for (const key in files) {
      file[key] = files[key]
    }
    // Valido que tenga el file
    if (file) {
      // Armo la ruta de destino
      const destinationPath = `admin/images/product-categories/${
        imageProductCategoryInstance.id
        }${file.image.name}`
      const destinationPathCover = `admin/images/product-categories/${
        imageProductCategoryInstance.id
        }${file.cover.name}`
      // Subo el archivo
      let location
      try {
        location = await uploadFile(file.image.path, destinationPath)
      } catch (error) {
        throw error
      }
      let locationCover
      try {
        locationCover = await uploadFile(file.cover.path, destinationPathCover)
      } catch (error) {
        throw error
      }
      // Actualizo la instancia
      try {
        await imageProductCategoryInstance.updateAttributes({
          image: location,
          cover: locationCover
        })
      } catch (error) {
        throw error
      }
    }

    return imageProductCategoryInstance
  }
  productCategoryParam.remoteMethod('createWithFile', {
    description: 'Crea la instancia con su respectivo archivo',
    accepts: {
      arg: 'req',
      type: 'object',
      http: {
        source: 'req'
      }
    }, // pass the request object to remote method
    returns: { root: true, type: 'object' },
    http: { path: '/create-with-file', verb: 'post' }
  })

  productCategoryParam.updateWithFile = async (id, req) => {
    // Busco la instancia
    let imageProductCategoryInstance
    try {
      imageProductCategoryInstance = await productCategoryParam.findById(id)
    } catch (error) {
      throw error
    }

    if (!imageProductCategoryInstance) {
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
    const { fields } = formData
    const obj = {}
    for (const key in fields) {
      obj[key] = fields[key]
    }

    // Obtengo el file
    const { files } = formData
    let file = {}
    for (const key in files) file[key] = files[key]
    // Valido que tenga el file
    if (file) {
      if (file.image) {
        // Armo la ruta de destino
        const destinationPath = `admin/images/product-categories/${
          imageProductCategoryInstance.id
          }${file.image.name}`
        // Subo el archivo
        let location
        try {
          location = await uploadFile(file.image.path, destinationPath)
        } catch (error) {
          throw error
        }
        obj.image = location
      }
      if (file.cover) {
        const destinationPathCover = `admin/images/product-categories/${
          imageProductCategoryInstance.id
          }${file.cover.name}`

        let locationCover
        try {
          locationCover = await uploadFile(
            file.cover.path,
            destinationPathCover
          )
        } catch (error) {
          throw error
        }

        obj.cover = locationCover
      }
    }
    // Actualizo la instancia
    try {
      await imageProductCategoryInstance.updateAttributes(obj)
    } catch (error) {
      throw error
    }

    return imageProductCategoryInstance
  }
  productCategoryParam.remoteMethod('updateWithFile', {
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
    returns: { root: true, type: 'object' },
    http: { path: '/:id/update-with-file', verb: 'patch' }
  })

  productCategoryParam.getCategories = async brandId => {
    const { Brand } = app.models
    let brandInstance
    try {
      brandInstance = await Brand.findById(brandId)
    } catch (error) {
      throw error
    }

    const sql =
      'select t2.id ' +
      'from public.brand t1 ' +
      'inner join public.productcategory t2 on t2.brandid = t1.id  ' +
      `where t1.id = ${brandInstance.id} ` +
      'and t2."level" = 1'

    let productCategoriesLevel1
    try {
      let result = await executeSQL(sql)

      const categoryIds = result.map(category => category.id)

      productCategoriesLevel1 = await productCategoryParam.find({
        where: { id: { inq: categoryIds } }
      })
    } catch (error) {
      throw error
    }

    const arrayMaster = []

    for (const categoryLevel1 of productCategoriesLevel1) {
      const childrensLevel1 = await categoryLevel1.childrenCategories.find()

      const category1 = {
        id: categoryLevel1.id,
        name: categoryLevel1.name,
        slug: categoryLevel1.slug,
        isMotivator: categoryLevel1.isMotivator,
        image: categoryLevel1.image,
        cover: categoryLevel1.cover,
        level: categoryLevel1.level,
        brandId: categoryLevel1.brandId,
        parentId: 0,
        childrenCategories: childrensLevel1
      }

      const array = []
      const productCategoriesLevel2 = category1.childrenCategories
      for (const categoryLevel2 of productCategoriesLevel2) {
        const childrensLevel2 = await categoryLevel2.childrenCategories.find()

        const category2 = {
          id: categoryLevel2.id,
          name: categoryLevel2.name,
          slug: categoryLevel2.slug,
          isMotivator: categoryLevel2.isMotivator,
          image: categoryLevel2.image,
          cover: categoryLevel2.cover,
          level: categoryLevel2.level,
          brandId: categoryLevel2.brandId,
          parentId: categoryLevel1.id,
          childrenCategories: childrensLevel2.map(item => ({
            parentId: categoryLevel2.id,
            ...item.__data
          }))
        }

        array.push(category2)
      }
      category1.childrenCategories = array
      arrayMaster.push(category1)
    }

    return arrayMaster
  }
  productCategoryParam.remoteMethod('getCategories', {
    description: 'Obtiene la rama de categorias',
    accepts: {
      arg: 'brandId',
      type: 'number',
      required: true
    }, // id de la marca
    returns: { root: true, type: 'object' },
    http: { path: '/:brandId/get-categories', verb: 'get' }
  })
}
