async function submitSheet(page, name) {
  const sheet = page.locator('#bpSheet');
  if (name !== undefined) await sheet.getByLabel('Name', {exact:true}).fill(name);
  await sheet.locator('[type="submit"]').click();
}
module.exports = {submitSheet};
