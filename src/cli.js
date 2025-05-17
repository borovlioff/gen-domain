import inquirer from 'inquirer';
import { renderTemplates } from "./renderer.js"
import path from 'path';
import { fileURLToPath } from 'node:url';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function askFields(entityName, nestedEntitiesNames = []) {
  const fields = [];
  const baseTypes = ['string', 'number', 'boolean', 'date', 'object'];
  const typeChoices = [...baseTypes, 'array', ...nestedEntitiesNames];

  let addMore = true;

  while (addMore) {
    const { fieldName } = await inquirer.prompt({
      type: 'input',
      name: 'fieldName',
      message: `Введите название поля для сущности "${entityName}":`,
      validate: input => input.trim() !== '' || 'Название поля не может быть пустым',
    });

    const { fieldType } = await inquirer.prompt({
      type: 'list',
      name: 'fieldType',
      message: `Выберите тип поля "${fieldName}":`,
      choices: typeChoices,
    });

    let finalType = fieldType;

    if (fieldType === 'array') {
      // Если выбрали массив, спрашиваем тип элементов массива
      const elementTypeChoices = [...baseTypes, ...nestedEntitiesNames];
      const { elementType } = await inquirer.prompt({
        type: 'list',
        name: 'elementType',
        message: `Выберите тип элементов массива для поля "${fieldName}":`,
        choices: elementTypeChoices,
      });
      finalType = `array<${elementType}>`;
    }

    fields.push({ name: fieldName, type: finalType });

    const { continueAddingFields } = await inquirer.prompt({
      type: 'confirm',
      name: 'continueAddingFields',
      message: 'Добавить ещё поле?',
      default: false,
    });

    addMore = continueAddingFields;
  }

  return fields;
}


async function askNestedEntities() {
  const nestedEntities = [];
  let addMore = true;

  while (addMore) {
    const { nestedName } = await inquirer.prompt({
      type: 'input',
      name: 'nestedName',
      message: 'Введите название вложенной сущности:',
      validate: input => input.trim() !== '' || 'Название не может быть пустым',
    });

    // Сразу после ввода названия вложенной сущности - добавить поля для неё
    console.log(`\nДобавьте поля для вложенной сущности "${nestedName}":`);
    const nestedFields = await askFields(nestedName);

    nestedEntities.push({ name: nestedName, fields: nestedFields });

    const { continueAdding } = await inquirer.prompt({
      type: 'confirm',
      name: 'continueAdding',
      message: 'Добавить ещё вложенную сущность?',
      default: false,
    });

    addMore = continueAdding;
  }

  return nestedEntities;
}

export async function cli(args) {
  let projectName = args[0] || null;
  console.log('=== Консольное приложение для настройки сущностей ===\n');

  // 1. Ввод названия основной сущности
  const { entity } = await inquirer.prompt({
    type: 'input',
    name: 'entity',
    message: 'Введите название основной сущности:',
    validate: input => input.trim() !== '' || 'Название не может быть пустым',
  });

  // 2. Есть ли вложенные сущности
  const { hasNested } = await inquirer.prompt({
    type: 'confirm',
    name: 'hasNested',
    message: 'Есть ли вложенные сущности?',
    default: false,
  });

  let nestedEntities = [];
  if (hasNested) {
    nestedEntities = await askNestedEntities();
  }

  // 3. Добавляем поля основной сущности, типы полей - базовые или вложенные сущности
  const nestedNames = nestedEntities.map(ne => ne.name);
  const mainEntityFields = await askFields(entity, nestedNames);

  // 4. Выбор базы данных
  const { dbChoice } = await inquirer.prompt({
    type: 'list',
    name: 'dbChoice',
    message: 'Выберите базу данных:',
    choices: ['InMemory', 'JSON', 'MySQL', 'MongoDB', 'PostgreSQL', 'Redis'],
  });

  // 5. Нужно ли REST API
  const { needRest } = await inquirer.prompt({
    type: 'confirm',
    name: 'needRest',
    message: 'Нужно ли REST API?',
    default: false,
  });

  let restAdapter = null;
  if (needRest) {
    const { restChoice } = await inquirer.prompt({
      type: 'list',
      name: 'restChoice',
      message: 'Выберите адаптер REST API:',
      choices: ['http (native)', 'express', 'fastify'],
    });
    restAdapter = restChoice;
  }

  // 6. Нужно ли Swagger
  const { needSwagger } = await inquirer.prompt({
    type: 'confirm',
    name: 'needSwagger',
    message: 'Нужен ли Swagger?',
    default: false,
  });

  // 7. Нужно ли брокер сообщений
  const { needBroker } = await inquirer.prompt({
    type: 'confirm',
    name: 'needBroker',
    message: 'Нужен ли брокер сообщений?',
    default: false,
  });

  let brokerAdapter = null;
  if (needBroker) {
    const { brokerChoice } = await inquirer.prompt({
      type: 'list',
      name: 'brokerChoice',
      message: 'Выберите адаптер брокера сообщений:',
      choices: ['RabbitMQ', 'Redis Pub/Sub', 'Apache Kafka', 'ActiveMQ', 'NATS'],
    });
    brokerAdapter = brokerChoice;
  }

  // 8. Нужно ли RPC
  const { needRpc } = await inquirer.prompt({
    type: 'confirm',
    name: 'needRpc',
    message: 'Нужен ли RPC?',
    default: false,
  });

  let rpcAdapter = null;
  if (needRpc) {
    const { rpcChoice } = await inquirer.prompt({
      type: 'list',
      name: 'rpcChoice',
      message: 'Выберите адаптер RPC:',
      choices: ['gRPC', 'JSON-RPC'],
    });
    rpcAdapter = rpcChoice;
  }

  // Итоговый вывод
  console.log('\n=== Итоговая конфигурация ===');
  console.log(`Основная сущность: ${entity}`);

  if (nestedEntities.length) {
    console.log('Вложенные сущности и их поля:');
    nestedEntities.forEach(ne => {
      console.log(`  - ${ne.name}:`);
      ne.fields.forEach(f => console.log(`      • ${f.name}: ${f.type}`));
    });
  } else {
    console.log('Вложенных сущностей нет.');
  }

  console.log('Поля основной сущности:');
  mainEntityFields.forEach(f => console.log(`  - ${f.name}: ${f.type}`));

  console.log(`База данных: ${dbChoice}`);
  console.log(`REST API: ${needRest ? `Да, адаптер: ${restAdapter}` : 'Нет'}`);
  console.log(`Swagger: ${needSwagger ? 'Да' : 'Нет'}`);
  console.log(`Брокер сообщений: ${needBroker ? `Да, адаптер: ${brokerAdapter}` : 'Нет'}`);
  console.log(`RPC: ${needRpc ? `Да, адаптер: ${rpcAdapter}` : 'Нет'}`);

projectName = projectName || `${entity}Service`;
  // Генерация проекта
  const templatePath = path.join(__dirname, 'templates/microservice-template');
  const targetPath = path.join(process.cwd(), projectName);

  await renderTemplates({
    templatePath,
    targetPath,
    projectName,
    entity,
    nestedEntities,
    fields: mainEntityFields,
    dbChoice,
    restAdapter,
    needSwagger,
    brokerAdapter,
    rpcAdapter,
  });

  console.log('\nСпасибо за использование приложения!');
}
