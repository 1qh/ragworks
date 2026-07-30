import { expect, test } from 'bun:test'
import { parse as parseHtml } from 'node-html-parser'
import { tableToRows } from './chandra'

const rowsOfHtml = (html: string): string[] => {
  const table = parseHtml(html).querySelector('table')
  if (!table) throw new Error('no table')
  return tableToRows(table)
}
test('tableToRows keeps each row self-describing with its column headers', () => {
  const rows = rowsOfHtml(
    '<table><thead><tr><th>Product</th><th>Retail</th><th>Corp</th></tr></thead>' +
      '<tbody><tr><td>Car</td><td>15%</td><td>4%</td></tr><tr><td>Bike</td><td>10%</td><td>3%</td></tr></tbody></table>'
  )
  expect(rows).toHaveLength(2)
  expect(rows[0]).toBe('Car │ Retail: 15% │ Corp: 4%')
  expect(rows[1]).toBe('Bike │ Retail: 10% │ Corp: 3%')
})
test('tableToRows resolves a colspan multi-level header into each cell', () => {
  const rows = rowsOfHtml(
    '<table><tr><th rowspan="2">Product</th><th colspan="2">Discount</th></tr>' +
      '<tr><th>Retail</th><th>Corp</th></tr>' +
      '<tr><td>Car</td><td>15%</td><td>4%</td></tr></table>'
  )
  expect(rows).toHaveLength(1)
  expect(rows[0]).toBe('Car │ Discount · Retail: 15% │ Discount · Corp: 4%')
})
test('tableToRows carries a rowspan cell down into every spanned data row', () => {
  const rows = rowsOfHtml(
    '<table><tr><th>Group</th><th>Item</th><th>Price</th></tr>' +
      '<tr><td rowspan="2">A</td><td>x</td><td>1</td></tr><tr><td>y</td><td>2</td></tr></table>'
  )
  expect(rows).toHaveLength(2)
  expect(rows[0]).toBe('A │ Item: x │ Price: 1')
  expect(rows[1]).toBe('A │ Item: y │ Price: 2')
})
