const firebaseAdmin = require('firebase-admin')
const auth = firebaseAdmin.auth()

/**
 * funcion encargada de actualizar el email del usuario
 *
 * @param {String} uid
 * @param String} email
 * @returns {Promise} objeto con la info
 */
const updateEmail = async (uid, email) => {
  // Actualizo el usuario
  try {
    auth.updateUser(uid, {
      email
    })
  } catch (error) {
    throw error
  }

  return {
    changed: true
  }
}

const updatePassword = async (uid, password) => {
  // Actualizo el password del usuario
  try {
    auth.updateUser(uid, {
      password
    })
  } catch (error) {
    throw error
  }

  return {
    changed: true
  }
}

module.exports = {
  updateEmail,
  updatePassword
}
