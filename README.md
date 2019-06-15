# Проверка актуальности API

## Установка

`npm install --save-dev api-changes-checker`

## Настройка

В корне проекта создайте `api-check.config.json` 
`{
  "url": "https://yandex.ru/robots.txt",
  "tmpPath": "./.api_check_tmp/"
}`

`url - URL актуальных данных`
`tmpPath - дирректория хранения временых файлов. Добавить в .gitignore`

### Подключение

Отредактируйте package.json

До
`
"scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build",
    ...
  },`

После
`
"scripts": {
    "start": "node ./node_modules/.bin/api-changes-checker && react-scripts start",
    "build": "react-scripts build",
    ...
  },`

