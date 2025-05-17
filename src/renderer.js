import fs from "fs-extra";
import path from "path";
import ejs from "ejs";


export async function renderTemplates({ templatePath, targetPath, ...data }) {
  try {

    await fs.copy(templatePath, targetPath);
    await renderDirectory(targetPath, data);
    await renameFiles(targetPath, 'Entity', data.entity);
  } catch (error) {
    throw new Error(`Ошибка при рендеринге шаблонов: ${error.message}`);
  }
}


async function renderDirectory(dir, data) {
  const files = await fs.readdir(dir);

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = await fs.stat(filePath);

    if (stat.isDirectory()) {
      await renderDirectory(filePath, data);
    } else if (path.extname(filePath) === '.ejs') {
      let content = await fs.readFile(filePath, 'utf-8');

      content = ejs.render(content, data, {
        locals: {
          toTsType: (type) => {
            switch (type) {
              case 'string': return 'string';
              case 'number': return 'number';
              case 'boolean': return 'boolean';
              case 'date': return 'Date';
              default: return 'any';
            }
          }
        }
      });
      await fs.writeFile(filePath.replace('.ejs', ''), content);
      await fs.remove(filePath);
    }
  }
}


async function renameFiles(dir, from, to) {
  const files = await fs.readdir(dir);

  for (const file of files) {
    const oldPath = path.join(dir, file);
    const newPath = path.join(dir, file.replace(new RegExp(from, 'g'), to));

    await fs.rename(oldPath, newPath);

    if ((await fs.stat(newPath)).isDirectory()) {
      await renameFiles(newPath, from, to);
    }
  }
}

