#!/usr/bin/env node

const path = require('path');
const fs = require('fs-extra');
const { Command } = require('commander');
const { input, confirm } = require('@inquirer/prompts'); // Используем новые пакеты [[1]]
const ejs = require('ejs');

const program = new Command();

program
  .arguments('<project-name>')
  .option('-e, --entity <name>', 'Entity name (required)')
  .option('--http', 'Enable HTTP API')
  .option('--rabbitmq', 'Enable RabbitMQ messaging')
  .option('--db <type>', 'Database type (mongodb|postgresql)', 'mongodb')
  .action(async (projectName, options) => {
    try {
      // Если entity не передано через CLI, запрашиваем его у пользователя
      const entityName = options.entity ||
        await input({
          message: 'Enter entity name:',
          validate: input => input ? true : 'Entity name is required'
        });

      // Запрашиваем поля сущности
      const fieldsInput = await input({
        message: 'Enter entity fields (format: "name:type", comma separated):',
        default: 'id:string,createdAt:date'
      });

      // Парсим поля в массив объектов
      const parsedFields = fieldsInput
        .split(',')
        .map(field => {
          const [name, type] = field.trim().split(':');
          return { name, type };
        });

      // Путь к шаблонам и целевой директории
      const templatePath = path.join(__dirname, 'templates/microservice-template');
      const targetPath = path.join(process.cwd(), projectName);

      // Копируем шаблоны в целевую директорию
      await fs.copy(templatePath, targetPath);

      // Рендерим шаблоны с данными
      await renderTemplates(targetPath, {
        entity: entityName,
        projectName,
        enableHttp: !!options.http,
        enableRabbitMQ: !!options.rabbitmq,
        dbType: options.db,
        fields: parsedFields
      });

      // Переименовываем файлы и папки
      await renameFiles(targetPath, 'Entity', entityName);

      console.log(`
        Микросервис успешно создан в ${targetPath}
        Для начала работы:
          cd ${projectName}
          npm install
          npm run dev
      `);
    } catch (error) {
      console.error('Ошибка при создании микросервиса:', error.message);
      process.exit(1);
    }
  })
  .parse(process.argv);

/**
 * Рендеринг шаблонов EJS
 * @param {string} dir - Директория для обработки
 * @param {object} data - Данные для рендеринга
 */
async function renderTemplates(dir, data) {
  const files = await fs.readdir(dir);

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = await fs.stat(filePath);

    if (stat.isDirectory()) {
      await renderTemplates(filePath, data);
    } else {
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
      await fs.writeFile(filePath, content);
    }
  }
}

/**
 * Переименование файлов и папок
 * @param {string} dir - Директория для обработки
 * @param {string} from - Старое имя
 * @param {string} to - Новое имя
 */
async function renameFiles(dir, from, to) {
  const files = await fs.readdir(dir);

  for (const file of files) {
    const oldPath = path.join(dir, file);
    const newPath = path.join(dir, file.replace(new RegExp(from, 'g'), to).replace('.ejs', ''));

    await fs.rename(oldPath, newPath);

    if ((await fs.stat(newPath)).isDirectory()) {
      await renameFiles(newPath, from, to);
    }
  }
}