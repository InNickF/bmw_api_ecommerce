// eslint-disable-next-line no-use-before-define

/*
    let soap = require('soap')
    let url = 'http://clientes.tcc.com.co/preservicios/wsdespachos.asmx?wsdl'
    let args = {name: 'value'}
    soap.createClientAsync(url).then((client) => {
        return client.GrabarDespachoAsync(args)
    }).then((result) => {
        console.log(result[0])
    })
*/

let soap = require('soap')
let url = 'http://currencyconverter.kowabunga.net/converter.asmx?WSDL'
let args = { }
soap.createClientAsync(url).then((client) => {
  // client.GetCurrenciesAsync(args).then((result) => {
  //  console.log(result[0])
  // })

  client.GetCurrencyRateAsync(args).then((result) => {
    console.log(result[0])
  })
  // return client.GetCurrenciesAsync(args)
}).then((result) => {

  // console.log(JSON.stringify(result[0]))
  // return result[0]

})
