const { XMLParser } = require('fast-xml-parser')

export async function xmlToJson(xmlData: string): Promise<any> {
  try {
    if (xmlData) {
      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '@_',
        parseAttributeValue: true,
      })
      const jsonObj = parser.parse(xmlData)

      return jsonObj
    } else {
      throw new Error('Error parsing no xml data provided')
    }
  } catch (err) {
    if (err instanceof Error) {
      console.error('Error executing query', err.stack)
    } else {
      console.error('Error executing query', err)
    }
    throw err
  }
}
