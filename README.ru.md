<div align="center">

# Secure Password Generator

[English](README.md) · **Русский**

### Исходное слово. Перемешанный пароль.

Библиотека TypeScript · интерактивный CLI для Node.js · Web Crypto

[![npm](https://img.shields.io/npm/v/ts-secure-password-generator?style=flat-square&color=7aa2f7)](https://www.npmjs.com/package/ts-secure-password-generator)
[![MIT](https://img.shields.io/badge/license-MIT-9ece6a?style=flat-square)](LICENSE.md)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=nodedotjs&logoColor=white)

[Установка](#установка) · [Библиотека](#библиотека) · [CLI](#cli) · [Ограничения](#безопасность-и-ограничения) · [Разработка](#разработка)

</div>

Генератор меняет регистр букв исходного слова, добавляет символы и перемешивает результат. Пакет предоставляет одну функцию и интерактивную команду. Имя опубликованного пакета npm — **`ts-secure-password-generator`**; оно отличается от имени репозитория.

## Установка

Используйте актуальную поддерживаемую версию Node.js с глобальным `crypto.getRandomValues`.

```sh
# Библиотека
npm install ts-secure-password-generator

# Интерактивный CLI
npm install --global ts-secure-password-generator
secure-passgen
```

## Библиотека

```ts
import { generatePassword } from 'ts-secure-password-generator';

const password = generatePassword('apple', 16);
// Передайте результат потребителю; не выводите реальные пароли в журнал.
```

CommonJS:

```js
const { generatePassword } = require('ts-secure-password-generator');
const password = generatePassword('apple', 16);
```

| Аргумент | Значение |
|:---|:---|
| `word: string` | Исходное слово; его символы сохраняются в результате с изменённым регистром |
| `length: number` | Желаемая длина: конечное целое число не меньше `word.length + 4` |
| Результат | Строка с паролем; при слишком маленькой длине выбрасывается ошибка |

Публичная точка входа экспортирует **`generatePassword`**, а не внутренний класс `PasswordService`. Для предсказуемой длины используйте ASCII. Реализация смешивает длину строки в UTF-16, кодовые точки и преобразование регистра Unicode, поэтому точная длина для произвольного Unicode не гарантируется.

## CLI

Запустите `secure-passgen`, введите исходное слово, затем желаемую длину. CLI напечатает пароль в терминале. Ввод не скрывается, а результат остаётся в истории экрана. Неинтерактивных аргументов командной строки нет.

## Как работает генерация

1. Случайно меняется регистр каждого символа исходного слова.
2. При отсутствии добавляются спецсимвол из `!@#$%^&*`, цифра и заглавная буква.
3. Длина дополняется буквами, цифрами и спецсимволами.
4. Результат перемешивается алгоритмом Фишера — Йетса.

## Безопасность и ограничения

- Источник случайных значений — `crypto.getRandomValues`. Выбор символов использует остаток от деления, что вносит смещение; генератор не проходил аудит, равномерность результата не заявляется.
- Исходное слово добавляет предсказуемую структуру. Одна длина пароля не определяет энтропию. Не используйте личный секрет как исходное слово.
- Проверяйте входные данные библиотеки: длина должна быть конечным целым числом с разумным верхним пределом. Библиотека не обеспечивает полную проверку `NaN`, бесконечности, дробных и чрезмерно больших значений.
- Точка входа npm — CommonJS с декларациями TypeScript. Для браузера нужны совместимый сборщик и Web Crypto; готовой браузерной сборки нет.
- CLI не сохраняет пароль в файл, но запись терминала и история экрана могут сохранить его вывод.

## Разработка

```sh
git clone https://github.com/IgorKramar/secure-password-generator.git
cd secure-password-generator
npm ci
npm run build
npm test
node dist/cli.js
```

`npm ci` также выполняет `prepare`, который собирает исходники TypeScript.

| Путь | Назначение |
|:---|:---|
| [src/index.ts](src/index.ts) | Публичный экспорт библиотеки |
| [src/domain/password.ts](src/domain/password.ts) | Генерация и выбор случайных значений |
| [src/application/passwordService.ts](src/application/passwordService.ts) | Внутренний сервис |
| [src/cli.ts](src/cli.ts) | Интерактивная команда |
| [tests/](tests/) | Тесты Jest |

## Лицензия

[MIT](LICENSE.md) · Copyright © 2024 Igor Kramar.
