import * as Util from '../utils'
const aws = require('aws-sdk')

export class AmazonWebServices {
  /**
   * Creates an instance of AmazonWebService.
   * @param {string} region
   * @param {string} accessKeyId
   * @param {string} secretAccessKey
   * @memberof AmazonWebService
   */
  constructor (region, accessKeyId, secretAccessKey) {
    this.AWS = aws
    this.AWS.config.update({
      region: region,
      accessKeyId: accessKeyId,
      secretAccessKey: secretAccessKey
    })
  }

  /**
   * Function to get the created buckets on s3
   *
   * @returns {object} with the information of buckets
   * @memberof AmazonWebServices
   */
  listBuckets () {
    return new Promise((resolve, reject) => {
      // Create S3 service object
      const s3 = new this.AWS.S3({apiVersion: '2006-03-01'})
      s3.listBuckets((err, data) => {
        if (err) return reject(err)
        return resolve(data)
      })
    })
  }

  /**
   *
   *
   * @param {string} bucketName nombre del bucket
   * @param {string} delimiter
   * @param {string} prefix
   * @returns
   * @memberof AmazonWebServices
   */
  listObjects (bucketName, delimiter, prefix) {
    return new Promise((resolve, reject) => {
      const params = {
        Bucket: bucketName,
        Delimiter: delimiter,
        Prefix: prefix
      }
      const s3 = new this.AWS.S3({apiVersion: '2006-03-01'})
      s3.listObjects(params, (err, data) => {
        if (err) return reject(err)
        return resolve(data)
      })
    })
  }

  createBucket (bucketName) {
    return new Promise((resolve, reject) => {
      // Create the parameters for calling createBucket
      const bucketParams = {
        Bucket: bucketName
      }
      // Create S3 service object
      const s3 = new this.AWS.S3({apiVersion: '2006-03-01'})
      // Call S3 to create the bucket
      s3.createBucket(bucketParams, (err, data) => {
        if (err) return reject(err)
        return resolve(data)
      })
    })
  }

  /**
   *
   *
   * @param {string} bucketName nombre del bucket
   * @param {File} file archivo que se desea subir
   * @param {string} pathAWS ruta en donde se desea ubicar el archivo en el bucket
   * @returns
   * @memberof AmazonWebServices
   */
  uploadFile (bucketName, file, destination) {
    return new Promise((resolve, reject) => {
      // Create S3 service object
      const s3 = new this.AWS.S3({apiVersion: '2006-03-01'})
      const uploadParams = {
        Bucket: bucketName,
        Key: destination,
        Body: file,
        ACL: 'public-read'
      }
      s3.upload(uploadParams, (err, data) => {
        if (err) return reject(err)
        return resolve(data.Location)
      })
    })
  }

  createQueue (params) {
    // Defino los atributos que deberia de tener el objeto
    let keys = ['QueueName', 'Attributes']
    let missingKeys = Util.getMissinKeys(keys, params)

    // Valido
    if (missingKeys.length > 0) {
      throw new Error(`a params le faltan ${missingKeys.toString()}`)
    }

    // Defino los atributos que deberia de tener el objeto
    keys = ['DelaySeconds', 'MessageRetentionPeriod', 'FifoQueue']
    missingKeys = Util.getMissinKeys(keys, params.Attributes)

    // Valido
    if (missingKeys.length > 0) {
      throw new Error(`a params.Attributes le faltan ${missingKeys.toString()}`)
    }

    // Creo la promesa
    return new Promise((resolve, reject) => {
      const sqs = new this.AWS.SQS({apiVersion: '2012-11-05'})
      sqs.createQueue(params, (err, data) => {
        if (err) return reject(err)
        return resolve(data.QueueUrl)
      })
    })
  }

  listQueues () {
    return new Promise((resolve, reject) => {
      const sqs = new this.AWS.SQS({apiVersion: '2012-11-05'})
      sqs.listQueues({}, (err, data) => {
        if (err) return reject(err)
        return resolve(data.QueueUrls)
      })
    })
  }

  getQueueUrl (name) {
    return new Promise((resolve, reject) => {
      const sqs = new this.AWS.SQS({apiVersion: '2012-11-05'})
      const params = {
        QueueName: name
      }
      sqs.getQueueUrl(params, (err, data) => {
        if (err) return reject(err)
        return resolve(data.QueueUrl)
      })
    })
  }

  deleteQueue (queueUrl) {
    return new Promise((resolve, reject) => {
      const sqs = new this.AWS.SQS({apiVersion: '2012-11-05'})
      const params = {
        QueueUrl: queueUrl
      }
      sqs.deleteQueue(params, (err, data) => {
        if (err) return reject(err)
        return resolve(data)
      })
    })
  }

  sendMessage (params) {
    const keys = ['MessageBody', 'QueueUrl']
    const missingKeys = Util.getMissinKeys(keys, params)
    // eslint-disable-next-line max-len
    if (missingKeys.length > 0) { throw new Error(`a params le faltan ${missingKeys.toString()}`) }
    return new Promise((resolve, reject) => {
      const sqs = new this.AWS.SQS({apiVersion: '2012-11-05'})
      sqs.sendMessage(params, (err, data) => {
        if (err) return reject(err)
        return resolve(data.MessageId)
      })
    })
  }

  receiveMessage (params) {
    // eslint-disable-next-line max-len
    const keys = ['AttributeNames', 'MaxNumberOfMessages', 'MessageAttributeNames', 'QueueUrl', 'VisibilityTimeout', 'WaitTimeSeconds']
    const missingKeys = Util.getMissinKeys(keys, params)
    // eslint-disable-next-line max-len
    if (missingKeys.length > 0) { throw new Error(`a params le faltan ${missingKeys.toString()}`) }
    return new Promise((resolve, reject) => {
      const sqs = new this.AWS.SQS({apiVersion: '2012-11-05'})
      sqs.receiveMessage(params, (err, data) => {
        if (err) return reject(err)
        return resolve(data)
      })
    })
  }

  deleteMessage (queueURL, receiptHandle) {
    return new Promise((resolve, reject) => {
      const sqs = new this.AWS.SQS({apiVersion: '2012-11-05'})
      const params = {
        QueueUrl: queueURL,
        ReceiptHandle: receiptHandle
      }
      sqs.deleteMessage(params, (err, data) => {
        if (err) return reject(err)
        return resolve(data)
      })
    })
  }
}
