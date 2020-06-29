import formidable from 'formidable'

const formatter = new Intl.NumberFormat('en', {
  style: 'currency',
  currency: 'COP',
  minimumFractionDigits: 0
})

export const priceFormatter = input =>
  formatter
    .format(input)
    .replace('COP', '$')
    .replace(/\,\b/gi, '.')

/**
 * Funcion para optener el archivo de una petición
 *
 * @param {Request} req
 * @returns {Promise}
 */
export function getFormData(req) {
  return new Promise((resolve, reject) => {
    const form = new formidable.IncomingForm()
    form.parse(req, (err, fields, files) => {
      if (err) return reject(err)

      let fieldsToReturn = []
      for (const key in fields) {
        fieldsToReturn[key] = fields[key]
      }

      let filesToReturn = []
      for (const key in files) {
        filesToReturn[key] = files[key]
      }

      const response = {
        fields: fieldsToReturn,
        files: filesToReturn
      }
      return resolve(response)
    })
  })
}

/**
 * Function to get the no present keys in a object
 * @param {array} keys
 * @param {Object} object
 * @returns {array}
 */
export function getMissinKeys(keys, object) {
  const array = keys
    .map(element => {
      const hasOwnProperty = Object.prototype.hasOwnProperty.call(
        object,
        element
      )
      if (!hasOwnProperty) {
        return element
      }

      return null
    })
    .filter(element => element !== null)
  return array
}

/**
 * Funcion encargada de retornar un objeto de la clase Error
 *
 * @param {String} errorMessage
 * @param {Number} statusCode
 * @returns {Object} de la clase Error
 */
export const returnError = (errorMessage, statusCode) => {
  const error = new Error(errorMessage)
  error.status = statusCode
  return error
}
