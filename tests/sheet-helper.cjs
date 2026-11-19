async function submitSheet(page, name) {
  const sheet = page.locator('#bpSheet');
  if (name !== undefined) await sheet.getByLabel('Name', {exact:true}).fill(name);
  await sheet.locator('[type="submit"]').click();
  await sheet.waitFor({state:'detached'});
}
module.exports = {submitSheet};
