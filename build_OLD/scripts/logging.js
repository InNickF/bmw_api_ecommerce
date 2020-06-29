const path = require('path')
// Get the .env path
const envPath = path.resolve(__dirname, '../.env')
// start dotenv
require('dotenv').config({
  path: envPath
})
const firebase = require('firebase')

const config = {
  apiKey: 'AIzaSyDah2M8XmkZXCCu8C1pPaWgCo3pi6-ibx0',
  authDomain: 'autogermana-dev.firebaseapp.com',
  databaseURL: 'https://autogermana-dev.firebaseio.com',
  projectId: 'autogermana-dev',
  storageBucket: 'autogermana-dev.appspot.com',
  messagingSenderId: '519491463617'
}
firebase.initializeApp(config)

firebase
  .auth()
  .signInWithEmailAndPassword('segundo.espana@imaginamos.com', '123456')
  .then(res =>
    console.log('accesToken ->', res.user.toJSON().stsTokenManager.accessToken)
  )
  .catch(err => console.log('error', err))
