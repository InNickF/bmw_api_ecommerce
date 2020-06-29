import * as app from '../server'

/**
 *
 *
 * @param {string} process
 * @param {string} description
 * @param {string} [messageId=null]
 * @param {boolean} [isError=false]
 */
export default async function registerLog (process, description, messageId = null, isError = false) {
  const {ProcessLog} = app.models
  const object = {
    process,
    description,
    messageId,
    isError
  }

  let instance
  try {
    instance = await ProcessLog.create(object)
  } catch (error) {
    throw error
  }

  return instance
}
