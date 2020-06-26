import {compile} from 'handlebars'
import mjml2html from 'mjml'
import fs from 'fs'
import * as path from 'path'

export const generateHtmlByEmailtemplate = (templateName, parameters) => {
  // get the path of the template
  const templatePath = path.resolve(__dirname, `../../email-templates/${templateName}.mjml`)

  const template = compile(fs.readFileSync(templatePath, 'utf8'))

  const mjml = template(parameters)

  const html = mjml2html(mjml).html

  return html
}
