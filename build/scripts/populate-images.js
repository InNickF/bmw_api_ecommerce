// eslint-disable
const s3tree = require('s3-tree')
const aws = require('aws-sdk')
/* const app = require('../server/server') */

aws.config.update({
  region: "us-west-1",
  accessKeyId: "AKIAJJ2U7LJ6TBDLVDPQ",
  secretAccessKey: "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"
})

const s3 = new aws.S3({ apiVersion: '2006-03-01' })

const generator = s3tree({ bucket: 'autogermana', s3 })

export default populateImages = async (folder) => {
  let tree
  const baseUrl = "https://s3-us-west-1.amazonaws.com/autogermana/"
  try {
    tree = await generator.generate(`/images/${folder}`)
  } catch (error) {
    throw error
  }



  /* const { Product } = app.models
  const { ImageProduct } = app.models */

  let counterLinked = 0
  let counterNoLinked = 0
  /* console.log(tree) */
  for (let key in tree) {
    console.log(key)
    /*    if (tree.hasOwnProperty(key)) {
         let productInstance
         try {
           productInstance = await Product.findOne({ where: { sku: key } })
         } catch (error) {
           throw error
         }
   
         if (productInstance) {
           const imagesInS3 = tree[key]
   
           for (const key in imagesInS3) {
             if (imagesInS3.hasOwnProperty(key)) {
               const url = `${baseUrl}${imagesInS3[key]}`
               const imageProductObj = {
                 productId: productInstance.id,
                 image: url
               }
   
               try {
                 await ImageProduct.findOrCreate({ where: imageProductObj }, imageProductObj)
               } catch (error) {
                 throw error
               }
             }
           }
   
           console.log(`${key}, enlazada`)
           counterLinked += 1
         } else {
           console.log(`${key}, si estan en ${folder} de S3, pero, no esta en nuestra BD`)
           counterNoLinked += 1
         }
       } */
  }

  console.log('Productos enlazados con sus imagenes', counterLinked)
  console.log('Productos que no existen en nuestra DB', counterNoLinked)

  return Promise.resolve()
}
// folder names motorrad, bmw, mini

/* populateImages('mini')
  .then(() => console.log('done'))
  .catch(err => console.log('error', err))
 */