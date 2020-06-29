import {AmazonWebServices} from '../services/aws'
const fs = require('fs')
const getParameterValue = require('./get-parameter-value')

/**
 *
 *
 * @param {string} sourcePath ruta del archivo que desea subir
 * @param {string} destinationPath ruta en donde desea poner el archivo en el bucket
 */
export const uploadFile = async (sourcePath, destinationPath) => {
  // obtengo la region
  const region = process.env.AWS_REGION

  // obtengo el accesskeyid
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID

  // obtengo el secretaccesskey
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY

  // creo la instancia de la clase
  // eslint-disable-next-line max-len
  const amazonWebServices = new AmazonWebServices(region, accessKeyId, secretAccessKey)

  // Obtengo el nombre del bucket
  const nameP = 'BUCKET_NAME'
  let bucketName = null
  try {
    bucketName = await getParameterValue(nameP)
  } catch (error) {
    throw error
  }

  // creo el stream
  let stream
  try {
    stream = await fs.createReadStream(sourcePath)
  } catch (error) {
    throw error
  }

  // eslint-disable-next-line one-var
  let url
  try {
    // eslint-disable-next-line max-len
    url = await amazonWebServices.uploadFile(bucketName, stream, destinationPath)
  } catch (error) {
    throw error
  }

  return url
}
