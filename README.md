# Fest
Fest — это шаблонизатор общего назначения, компилирующий XML шаблоны в самодостаточные JavaScript функции. Для установки требуется Node.js >= 0.8.
![alt text](http://24.media.tumblr.com/0fc9023daa303558d036ecd63fd2c24e/tumblr_mjedslIPPH1qbyxr0o1_500.gif "My fest")
### кастрированная версия
* нет неймспейса fest
* нет контекста, внутри шаблона есть только params
* выпилины конструкции:
  - `template` - контексты убраны
  - `text` - нецелесообразен
  - `element` - полигон для усложнений
  - `attributes` - нецелесообразен
  - `attribute` - нецелесообразен
  - `each` - заменён на `for`
  - `choose` - заменён на `switch`
  - `when` - заменён на `case`
  - `otherwise` - заменён на `default`
  - `script` - полигон для усложнений

* изменены параметры и значения по умолчанию
  ~ `value` _output_ -> _escape_ по умолчанию **text**, вместо html
  ~ `for` _from="1" to="5"_ **выпилено**

* добавлены
  + `for` _in_ <- `each`
  + `switch` <- `choose`
  + `case` <- `when`
  + `default` <- `otherwise`

## Установка

```
npm install fest
```

## Введение

Шаблоны представляют собой псевдо XML документы, содержащие HTML, текстовые данные и управляющие конструкции.

```xml
  Hello, <value>params.name</value>!
```

_Замечание: начальные и конечные пробелы в текстовых узлах удаляются при компиляции. Если необходимо вывести символ пробела, можно вопспользоваться `<space />`._

## Данные и вывод

### value

Служит для вывода значения JavaScript выражения. Поддерживаем 4 режима вывода: text (по умолчанию), html, js и json.

```xml
<var name="value" value='"<script/>"' />
<value>value</value><!-- "<script/>" -->
<value escape="html">value</value><!-- &quot;&lt;script/&gt;&quot; -->
<value escape="js">value</value><!-- \"\u003Cscript\/\u003E\" -->
<value escape="json">value</value><!-- "\"\u003Cscript/\u003E\"" -->
```

### var

Устаналивает локальную JavaScript переменную.

```xml
<var name="question" value="Ultimate Question of Life, The Universe, and Everything" />
<value>question</value><!-- Ultimate Question of Life, The Universe, and Everything -->
<var name="answer" select="question.length - 13" />
<value>answer</value><!-- 42  -->
```

### space

Служит для вывода пробела. Необходим в тех случаях, когда пробел в тектовом узле удаляется при компиляции, например:

```xml
Hello,<space/><value>json.name</value>!<!-- Hello, John! -->
```

### set

Объявляет именованный блок. Содержимое `set` не будет выполнено до тех пор, пока не будет вызван блок с таким же имененем с помощью `get`.

```xml
<set name="name">John</set>
```

```xml
<set name="full_name">
    <get name="name"/><space/>F. Kennedy
</set>
```

Внутри `set` доступен контекст `params`, передаваемый через `get`.

```xml
<set name="line">
  Hello,<space/><value>params.username</value>!
</set>
<get name="line">{username: "John"}</get><!-- Hello, John! -->
```

### get

Выводит содержимое блока, объявленного через `set`.

```xml
<get name="name"/>
```

```xml
<get name="name">{'some': 'data'}</get>
```

Внутри атрибута `name` можно использовать JavaScript выражения для вычисления имени блока во время выполнения. Значения выражений, заключенных в фигурные скобки, объединяются с примыкающим текстом. Помимо этого, можно использовать атрибут `select`.

```xml
<var name="name" value="'foo'" />
<get select="name"/><!-- foo -->
<set name="foo">foo</set>
<set name="bar">bar</set>
<get name="b{true?'a':''}r"/><!-- bar -->
```

Существует быстрый способ вывести значение в атрибут:

```xml
<a href="{params.href}">Some link</a>
```

## Управляющие конструкции

### for

Выполняет итерацию по массиву или числовому ряду.

```xml
<!-- params.items = ['a', 'b', 'c'] -->
<for iterate="params.items" index="i">
  <value>params.items[i]</value>
</for><!-- abc -->
<for iterate="params.items" index="i" value="v">
  <value>v</value>
</for><!-- abc -->
```

### if, elseif, else

Условный оператор.

```xml
<if test="var">
    IF!
  <elseif test="var2" />
    ELSEIF?
  <else />
    ELSE.
</if>
```

### switch case default

```xml
<switch test="var">
<case is="1" />
  var is 1
<case is="2" />
  var is 2
<default />
  var is not 1 or 2
</switch>
```

## Остальные конструкции

### cdata

Служит для вывода блока CDATA.

```xml
<cdata>
  alert ("2" < 3);
</cdata><!-- <![CDATA[alert ("2" < 3);]]> -->
```

### comment

Выводит HTML комментарий.

```xml
<comment>comment</comment><!-- <!--comment--> -->
```

### doctype

Задает DOCTYPE генерируемой страницы.

```xml
<doctype>html</doctype><!-- <!doctype html> -->
```

### include

Вставляет содержимое другого шаблона с заданным params.

```xml
<include params="params.foreach" src="./include_foreach.xml" />
<include src="./include_foreach.xml">
  params.foreach
</include>

```

### insert

Выводит содержимое файла:

```xml
<style type="text/css">
  <insert src="style.css" />
<style>
```

# Примеры

## Использование

Компиляция с помощью compile():
```javascript
var fest = require('fest');

var data = {name: 'Jack "The Ripper"'},
    template = './templates/basic.xml';

var compiled = fest.compile(template, {beautify: false}),
    template = (new Function('return ' + compiled))();

console.log(template(data));
```

Компиляция с последующей отрисовкой с помощью render():
```javascript
var fest = require('fest');

var data = {name: 'Jack "The Ripper"'},
    template = './templates/basic.xml';

console.log(fest.render(template, data, {beautify: false}));
```

basic.xml
```xml
<?xml version="1.0"?>
<fest:template xmlns:fest="http://fest.mail.ru" context_name="json">
    <h1>Hello,<fest:space/><fest:value output="text">json.name</fest:value></h1>
    <!-- По умолчанию все значения fest:value экранируются -->
    <!--
        Необходимо использовать fest:space или
        fest:text для явного указания строк с пробелами
    -->
</fest:template>
```

Результат:

```html
<h1>Hello, Jack "The Ripper"</h1>
```

## Вложенные шаблоны

Данные на вход:
```javascript
var data = {
    people: [
        {name: 'John', age: 20},
        {name: 'Mary', age: 21},
        {name: 'Gary', age: 55}
    ],
    append: '>>'
}
```

foreach.xml (основной шаблон):
```xml
<?xml version="1.0"?>
<fest:template xmlns:fest="http://fest.mail.ru" context_name="json">

    <!-- Контекст можно передавать во вложенные шаблоны -->
    <fest:include context_name="json" src="./person.xml"/>

    <!-- Значением iterate может быть любое js-выражение -->
    <fest:for iterate="json.people.reverse()" index="i">
        <!-- Передаваемые значения будут доступны в контексте params -->
        <fest:get name="person">json.people[i]</fest:get>
    </fest:for>
</fest:template>
```

person.xml:
```xml
<?xml version="1.0"?>
<fest:template xmlns:fest="http://fest.mail.ru" context_name="json">

    <!--
        Используем set для объявления блока,
        который используем в родительском шаблоне
    -->
    <fest:set name="person">
        <p>
            <fest:script><![CDATA[
                var first = params.name[0],
                    other = params.name.slice(1);
            ]]></fest:script>
            <fest:value>json.append</fest:value>
            <strong>
                <fest:value>first</fest:value>
            </strong>
            <fest:value>other</fest:value>
        </p>
    </fest:set>
</fest:template>
```

Результат:
```html
<p>&gt;&gt;<strong>G</strong>ary</p>
<p>&gt;&gt;<strong>M</strong>ary</p>
<p>&gt;&gt;<strong>J</strong>ohn</p>
```

## Использование set и get

```xml
<?xml version="1.0"?>
<fest:template xmlns:fest="http://fest.mail.ru" context_name="json">
    <fest:set name="host">http://e.mail.ru</fest:set>
    <fest:set name="all">msglist</fest:set>
    <fest:set name="new">sentmsg?compose</fest:set>

    <fest:set name="all_link">
        <fest:get name="host"/>/<fest:get name="all"/>
    </fest:set>

    <fest:set name="new_link">
        <fest:get name="host"/>/<fest:get name="new"/>
    </fest:set>

    <ul>
        <!-- fest:attribute добавляет параметр к родительскому тегу -->
        <li><a>
            <fest:attributes>
                <fest:attribute name="href"><fest:get name="all_link"/></fest:attribute>
            </fest:attributes>
            Все сообщения
        </a></li>

        <li><a>
            <fest:attributes>
                <fest:attribute name="href"><fest:get name="new_link"/></fest:attribute>
            </fest:attributes>
            Написать письмо
        </a></li>
    </ul>
</fest:template>
```

Результат:

```html
<ul>
    <li><a href="http://e.mail.ru/msglist">Все сообщения</a></li>
    <li><a href="http://e.mail.ru/sentmsg?compose">Написать письмо</a></li>
</ul>
```

## Интернационализация

### fest:plural

По умолчанию доступна поддержка плюрализации для русского и английского языка. В параметрах `fest.compile` можно передать любую другую функцию плюрализации.

```xml
<fest:plural select="json.n">один рубль|%s рубля|%s рублей</fest:plural>
```
Или англоязычный вариант:

```xml
<fest:plural select="json.n">one ruble|%s rubles</fest:plural>
```

Чтобы вывести символ “%” внутри тега `fest:plural` используйте “%%”:

```xml
<fest:plural select="json.n">…1%%…|…%s%%…|…%s%%…</fest:plural>
```

### fest:message и fest:msg

Позволяет указать границы фразы для перевода и контекст для снятия многозначности. Например,

```xml
<fest:message context="растение">Лук</fest:message>
<fest:message context="оружие">Лук</fest:message>
```

Для каждого `fest:message`, `fest:msg`, обычного текста, заключенного между XML тегами (опция `auto_message`), или текстового значения некоторых атрибутов компилятор вызывает функцию `events.message` (если такая была указана в параметрах). Данный механизм используется в `fest-build` утилите для построения оригинального PO-файла.

Пример вызова `fest-build` для создания PO-файла:

```
$ fest-build --dir=fest --po=ru_RU.po --compile.auto_message=true
```

Пример компиляции локализованных шаблонов:

```
$ fest-build --dir=fest --translate=en_US.po
```

Пример компиляции одного шаблона:

```
$ fest-compile path/to/template.xml
$ fest-compile --out=path/to/compiled.js path/to/template.xml
$ fest-compile --out=path/to/compiled.js --translate=path/to/en_US.po path/to/template.xml
```

## Contribution

Необходимо установить [Grunt](http://gruntjs.com):

```
$ git clone git@github.com:mailru/fest.git
$ cd fest
$ sudo npm install -g grunt-cli
$ npm install
$ grunt
```

Grunt используется для валидации JS (тестов) и запуска тестов. Перед отправкой пулл-риквеста убедись, что успешно выполнены `git rebase master` и `grunt`.

Если необходимо пересобрать шаблоны spec/expected, то выполните:

```
$ ./bin/fest-build --dir=spec/templates --exclude=*error* --compile.beautify=true --out=spec/expected/initial
$ ./bin/fest-build --dir=spec/templates --exclude=*error* --compile.beautify=true --out=spec/expected/translated --translate=spec/templates/en_US.po
```







        
        <var name="a">
          <div class="varA">VarA</div>
          <get name="varA" />
        </var>

        <switch test="params.a">
          <case is="2" />
            <div>TROLOLO 2</div>
          <case is="3" />
            <div>TROLOLO 3</div>
          <default />
            DEFAULT!!
        </switch>

        <if test="params.test !== 'test'">
            trololo IIIFFF
          <elseif test="params.test === rerere" />
            ELEEEIFFF
          <else />
            ELSE
        </if>

        <var name="b" value="acascasca" />
        <var name="c" select="params.c ? asdasdasd : ascascasc " />

        <get name="header">
          <params>params.header</params>
          <param name="a">
            <div class="params.a">PARAMS</div>
          </param>
          <param name="b" select=" params.a ? 12 : 23 " />
        </get>
