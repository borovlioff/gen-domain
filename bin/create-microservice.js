#!/usr/bin/env node

const path = require('path');
const fs = require('fs-extra');
const { Command } = require('commander');
const inquirer = require('inquirer');
const ejs = require('ejs');

const program = new Command();

program
  .arguments('<project-name>')
  .option('-e, --entity <name>', 'Entity name (required)')
  .option('--http', 'Enable HTTP API')
  .option('--rabbitmq', 'Enable RabbitMQ messaging')
  .action(async (projectName, options) => {
    const entityName = options.entity || 
      (await inquirer.prompt([{
        type: 'input',
        name: 'entity',
        message: 'Enter entity name:',
        validate: input => input ? true : 'Entity name is required'
      }])).entity;

    const fields = await inquirer.prompt([{
      type: 'input',
      name: 'fields',
      message: 'Enter entity fields (format: "name:type", comma separated):',
      default: 'id:string,createdAt:date'
    }]);

    const parsedFields = fields.fields
      .split(',')
      .map(f => {
        const [name, type] = f.trim().split(':');
        return { name, type };
      });

    const templatePath = path.join(__dirname, '../templates/microservice-template');
    const targetPath = path.join(process.cwd(), projectName);

    await fs.copy(templatePath, targetPath);
    
    await renderTemplates(targetPath, { 
      entity: entityName,
      projectName,
      enableHttp: !!options.http,
      enableRabbitMQ: !!options.rabbitmq,
      fields: parsedFields
    });
    
    await renameFiles(targetPath, 'Entity', entityName);

    console.log(`
      Микросервис создан в ${targetPath}
      Используйте:
        cd ${projectName}
        npm install
        npm run dev
    `);
  })
  .parse(process.argv);

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
            switch(type) {
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