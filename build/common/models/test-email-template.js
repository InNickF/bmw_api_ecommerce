import {generateHtmlByEmailtemplate} from '../../server/functions/generate-html-by-email-template'

const parameters = {
  user: {
    profile: {
      firstName: 'Segundo',
      lastName: 'España'
    }
  },
  order: {
    id: 1
  }
}

const html = generateHtmlByEmailtemplate('order-succes', parameters)

console.log(html)
