/* IntelliJ IDEA: горячие клавиши, приёмы и секреты, отладка, постфиксы и шаблоны, настройки и плагины, тренажёр сочетаний. */
(function () {
  'use strict';
  // [категория, действие, Windows/Linux, macOS, пояснение]
  const KEYS = [
    ['Поиск и навигация', 'Искать везде (классы, файлы, действия, настройки)', 'Shift Shift', 'Shift Shift', 'Самое полезное сочетание: начните с него'],
    ['Поиск и навигация', 'Найти действие по названию', 'Ctrl+Shift+A', 'Cmd+Shift+A', 'Любая команда меню и переключатель настроек'],
    ['Поиск и навигация', 'Перейти к классу', 'Ctrl+N', 'Cmd+O', 'Работает по заглавным буквам: OSI → OrderServiceImpl'],
    ['Поиск и навигация', 'Перейти к файлу', 'Ctrl+Shift+N', 'Cmd+Shift+O', 'application.yml, pom.xml, ресурсы'],
    ['Поиск и навигация', 'Перейти к символу (метод, поле)', 'Ctrl+Alt+Shift+N', 'Cmd+Option+O', ''],
    ['Поиск и навигация', 'Недавние файлы', 'Ctrl+E', 'Cmd+E', 'Повторное нажатие — только изменённые'],
    ['Поиск и навигация', 'Недавние места в коде', 'Ctrl+Shift+E', 'Cmd+Shift+E', ''],
    ['Поиск и навигация', 'Перейти к объявлению', 'Ctrl+B', 'Cmd+B', 'Или Ctrl+клик (Cmd+клик)'],
    ['Поиск и навигация', 'Перейти к реализации', 'Ctrl+Alt+B', 'Cmd+Option+B', 'Из интерфейса — в реализацию'],
    ['Поиск и навигация', 'Перейти к методу родителя', 'Ctrl+U', 'Cmd+U', ''],
    ['Поиск и навигация', 'Структура файла', 'Ctrl+F12', 'Cmd+F12', 'Можно сразу печатать имя метода'],
    ['Поиск и навигация', 'Иерархия типов', 'Ctrl+H', 'Ctrl+H', ''],
    ['Поиск и навигация', 'Иерархия вызовов', 'Ctrl+Alt+H', 'Ctrl+Option+H', 'Кто вызывает метод'],
    ['Поиск и навигация', 'Найти использования', 'Alt+F7', 'Option+F7', ''],
    ['Поиск и навигация', 'Подсветить использования в файле', 'Ctrl+Shift+F7', 'Cmd+Shift+F7', ''],
    ['Поиск и навигация', 'Поиск по всем файлам', 'Ctrl+Shift+F', 'Cmd+Shift+F', 'С регулярными выражениями и областью поиска'],
    ['Поиск и навигация', 'Замена во всех файлах', 'Ctrl+Shift+R', 'Cmd+Shift+R', ''],
    ['Поиск и навигация', 'Назад / вперёд по истории переходов', 'Ctrl+Alt+← / →', 'Cmd+[ / Cmd+]', ''],
    ['Поиск и навигация', 'Перейти к строке', 'Ctrl+G', 'Cmd+L', ''],
    ['Поиск и навигация', 'Следующая / предыдущая ошибка', 'F2 / Shift+F2', 'F2 / Shift+F2', ''],
    ['Поиск и навигация', 'Перейти к тесту и обратно', 'Ctrl+Shift+T', 'Cmd+Shift+T', 'Если теста нет — предложит создать'],
    ['Поиск и навигация', 'Показать файл в дереве проекта', 'Alt+F1', 'Option+F1', ''],
    ['Поиск и навигация', 'Переключатель вкладок и окон', 'Ctrl+Tab', 'Ctrl+Tab', ''],
    ['Редактирование', 'Исправления и действия (лампочка)', 'Alt+Enter', 'Option+Enter', 'Импорт, исправление ошибки, преобразование кода'],
    ['Редактирование', 'Базовое автодополнение', 'Ctrl+Space', 'Ctrl+Space', ''],
    ['Редактирование', '«Умное» автодополнение по типу', 'Ctrl+Shift+Space', 'Ctrl+Shift+Space', ''],
    ['Редактирование', 'Завершить выражение', 'Ctrl+Shift+Enter', 'Cmd+Shift+Enter', 'Поставит скобки, точку с запятой, фигурные скобки'],
    ['Редактирование', 'Сгенерировать код (конструктор, геттеры, equals)', 'Alt+Insert', 'Cmd+N', ''],
    ['Редактирование', 'Переопределить методы', 'Ctrl+O', 'Ctrl+O', ''],
    ['Редактирование', 'Реализовать методы интерфейса', 'Ctrl+I', 'Ctrl+I', ''],
    ['Редактирование', 'Обернуть в (try, if, for)', 'Ctrl+Alt+T', 'Cmd+Option+T', ''],
    ['Редактирование', 'Закомментировать строку', 'Ctrl+/', 'Cmd+/', ''],
    ['Редактирование', 'Блочный комментарий', 'Ctrl+Shift+/', 'Cmd+Option+/', ''],
    ['Редактирование', 'Дублировать строку или выделение', 'Ctrl+D', 'Cmd+D', ''],
    ['Редактирование', 'Удалить строку', 'Ctrl+Y', 'Cmd+Backspace', ''],
    ['Редактирование', 'Переместить строку вверх / вниз', 'Alt+Shift+↑ / ↓', 'Option+Shift+↑ / ↓', ''],
    ['Редактирование', 'Переместить выражение или метод', 'Ctrl+Shift+↑ / ↓', 'Cmd+Shift+↑ / ↓', 'Двигает целые методы и блоки'],
    ['Редактирование', 'Расширить выделение', 'Ctrl+W', 'Option+↑', 'Слово → выражение → строка → блок → метод'],
    ['Редактирование', 'Сузить выделение', 'Ctrl+Shift+W', 'Option+↓', ''],
    ['Редактирование', 'Переформатировать код', 'Ctrl+Alt+L', 'Cmd+Option+L', ''],
    ['Редактирование', 'Оптимизировать импорты', 'Ctrl+Alt+O', 'Ctrl+Option+O', ''],
    ['Редактирование', 'Добавить курсор на следующее вхождение', 'Alt+J', 'Ctrl+G', 'Мультикурсор: повторяйте нажатие'],
    ['Редактирование', 'Выделить все вхождения', 'Ctrl+Alt+Shift+J', 'Ctrl+Cmd+G', ''],
    ['Редактирование', 'Режим выделения столбцом', 'Alt+Shift+Insert', 'Cmd+Shift+8', 'Или Alt+перетаскивание мышью'],
    ['Редактирование', 'Подсказка параметров метода', 'Ctrl+P', 'Cmd+P', ''],
    ['Редактирование', 'Быстрая документация', 'Ctrl+Q', 'F1', ''],
    ['Редактирование', 'Быстрый просмотр определения', 'Ctrl+Shift+I', 'Option+Space', ''],
    ['Редактирование', 'Сменить регистр', 'Ctrl+Shift+U', 'Cmd+Shift+U', ''],
    ['Редактирование', 'Вставка из истории буфера', 'Ctrl+Shift+V', 'Cmd+Shift+V', ''],
    ['Рефакторинг', 'Меню рефакторингов', 'Ctrl+Alt+Shift+T', 'Ctrl+T', 'Если не помните конкретное сочетание'],
    ['Рефакторинг', 'Переименовать', 'Shift+F6', 'Shift+F6', 'Меняет все использования'],
    ['Рефакторинг', 'Изменить сигнатуру', 'Ctrl+F6', 'Cmd+F6', ''],
    ['Рефакторинг', 'Выделить метод', 'Ctrl+Alt+M', 'Cmd+Option+M', 'Находит и дубликаты фрагмента'],
    ['Рефакторинг', 'Выделить переменную', 'Ctrl+Alt+V', 'Cmd+Option+V', ''],
    ['Рефакторинг', 'Выделить поле', 'Ctrl+Alt+F', 'Cmd+Option+F', ''],
    ['Рефакторинг', 'Выделить константу', 'Ctrl+Alt+C', 'Cmd+Option+C', 'Лечит магические числа и строки'],
    ['Рефакторинг', 'Выделить параметр', 'Ctrl+Alt+P', 'Cmd+Option+P', ''],
    ['Рефакторинг', 'Встроить (inline)', 'Ctrl+Alt+N', 'Cmd+Option+N', ''],
    ['Рефакторинг', 'Переместить', 'F6', 'F6', ''],
    ['Рефакторинг', 'Безопасное удаление', 'Alt+Delete', 'Cmd+Delete', 'Проверит использования перед удалением'],
    ['Запуск и отладка', 'Запустить', 'Shift+F10', 'Ctrl+R', ''],
    ['Запуск и отладка', 'Отладка', 'Shift+F9', 'Ctrl+D', ''],
    ['Запуск и отладка', 'Запустить класс или тест под курсором', 'Ctrl+Shift+F10', 'Ctrl+Shift+R', ''],
    ['Запуск и отладка', 'Поставить / снять точку останова', 'Ctrl+F8', 'Cmd+F8', ''],
    ['Запуск и отладка', 'Все точки останова', 'Ctrl+Shift+F8', 'Cmd+Shift+F8', 'Условия, исключения, логирование'],
    ['Запуск и отладка', 'Шаг с обходом (step over)', 'F8', 'F8', ''],
    ['Запуск и отладка', 'Шаг с заходом (step into)', 'F7', 'F7', ''],
    ['Запуск и отладка', 'Умный заход в нужный вызов', 'Shift+F7', 'Shift+F7', 'Если в строке несколько вызовов'],
    ['Запуск и отладка', 'Шаг с выходом (step out)', 'Shift+F8', 'Shift+F8', ''],
    ['Запуск и отладка', 'Выполнить до курсора', 'Alt+F9', 'Option+F9', ''],
    ['Запуск и отладка', 'Вычислить выражение', 'Alt+F8', 'Option+F8', 'Можно вызвать метод и изменить значение'],
    ['Запуск и отладка', 'Продолжить выполнение', 'F9', 'Cmd+Option+R', ''],
    ['Запуск и отладка', 'Остановить', 'Ctrl+F2', 'Cmd+F2', ''],
    ['Запуск и отладка', 'Собрать проект', 'Ctrl+F9', 'Cmd+F9', ''],
    ['Git', 'Меню Git (VCS)', 'Alt+`', 'Ctrl+V', ''],
    ['Git', 'Коммит', 'Ctrl+K', 'Cmd+K', ''],
    ['Git', 'Push', 'Ctrl+Shift+K', 'Cmd+Shift+K', ''],
    ['Git', 'Обновить проект (pull)', 'Ctrl+T', 'Cmd+T', ''],
    ['Git', 'Откатить изменения', 'Ctrl+Alt+Z', 'Cmd+Option+Z', ''],
    ['Окна и настройки', 'Окно проекта', 'Alt+1', 'Cmd+1', 'Повторное нажатие — скрыть'],
    ['Окна и настройки', 'Окно коммита', 'Alt+0', 'Cmd+0', ''],
    ['Окна и настройки', 'Окно Git (лог)', 'Alt+9', 'Cmd+9', ''],
    ['Окна и настройки', 'Терминал', 'Alt+F12', 'Option+F12', ''],
    ['Окна и настройки', 'Скрыть все окна', 'Ctrl+Shift+F12', 'Cmd+Shift+F12', 'Только редактор'],
    ['Окна и настройки', 'Вернуться в редактор', 'Esc', 'Esc', ''],
    ['Окна и настройки', 'Настройки', 'Ctrl+Alt+S', 'Cmd+,', ''],
    ['Окна и настройки', 'Структура проекта (JDK, модули)', 'Ctrl+Alt+Shift+S', 'Cmd+;', ''],
    ['Окна и настройки', 'Закрыть вкладку', 'Ctrl+F4', 'Cmd+W', ''],
  ];

  // Приёмы: [раздел, заголовок, html]
  const TIPS = [
    ['Поиск и навигация', 'Двойной Shift — начало всего', 'Ищет классы, файлы, символы, действия и даже пункты настроек. Вкладки внутри окна (Classes, Files, Actions) переключаются Tab. Для действий можно печатать по-русски, если интерфейс на русском.'],
    ['Поиск и навигация', 'Поиск по «горбам» CamelCase', 'В «Перейти к классу» достаточно заглавных букв: <code>OSI</code> найдёт <code>OrderServiceImpl</code>, <code>*Repo</code> — все репозитории. Номер строки через двоеточие: <code>OrderService:120</code>.'],
    ['Поиск и навигация', 'Recent Locations', 'Ctrl+Shift+E показывает последние места, где вы были, с фрагментом кода — быстрее, чем искать вкладку.'],
    ['Поиск и навигация', 'Структурный поиск и замена', 'Edit → Find → Search Structurally: поиск по шаблону кода, например все вызовы <code>$a$.equals($b$)</code>, где a — строковый литерал. Replace Structurally массово переписывает код по шаблону.'],
    ['Редактирование', 'Alt+Enter решает почти всё', 'Импорт класса, исправление ошибки, преобразование цикла в стрим и обратно, замена анонимного класса лямбдой, добавление поля в конструктор, создание теста, преобразование класса в record.'],
    ['Редактирование', 'Мультикурсор', 'Alt+J (Ctrl+G на macOS) добавляет курсор на следующее вхождение выделенного текста — удобно переименовать несколько локальных вещей без рефакторинга. Alt+клик ставит курсоры вручную.'],
    ['Редактирование', 'Расширение выделения', 'Ctrl+W последовательно выделяет слово, выражение, аргумент, строку, блок, метод. Вместе с Ctrl+Alt+V (выделить переменную) и Ctrl+Alt+M (выделить метод) это основа быстрого рефакторинга.'],
    ['Редактирование', 'Внедрение языков', 'В строке с SQL, JSON или регулярным выражением IDE подсвечивает и проверяет язык. Включить вручную: Alt+Enter → Inject language. Для регулярных выражений — Alt+Enter → Check RegExp: проверка на примерах прямо в IDE.'],
    ['Редактирование', 'Scratch-файлы', 'Ctrl+Alt+Shift+Insert (Cmd+Shift+N) — черновой файл любого типа вне проекта: проверить кусок Java-кода, JSON, SQL-запрос к подключённой БД.'],
    ['Редактирование', 'Local History — машина времени', 'Правый клик по файлу или папке → Local History → Show History. IDE хранит историю изменений даже без Git: можно вернуть удалённый файл или код до неудачного рефакторинга.'],
    ['Рефакторинг', 'Сначала тесты, потом рефакторинг', 'Автоматические рефакторинги IDE безопаснее ручных, но запускайте тесты после каждого шага: Ctrl+Shift+F10 на тестовом классе.'],
    ['Рефакторинг', 'Выделение метода с дубликатами', 'Ctrl+Alt+M после извлечения предлагает заменить такие же фрагменты в классе вызовом нового метода.'],
    ['Рефакторинг', 'Миграции', 'Refactor → Migrate Packages and Classes: например, javax → jakarta при переходе на Spring Boot 3. Для массовых изменений версии API есть и OpenRewrite (плагин и Maven-плагин).'],
    ['Рефакторинг', 'Inspect Code', 'Code → Inspect Code: анализ всего проекта — неиспользуемый код, возможные NPE, устаревшие API. Найденное часто исправляется пачкой через Alt+Enter.'],
    ['Git', 'Git прямо в IDE', 'Окно Git (Alt+9): граф веток, cherry-pick и revert из контекстного меню коммита, сравнение веток. Интерактивный rebase — правый клик по коммиту → Interactively Rebase from Here.'],
    ['Git', 'Разрешение конфликтов', 'Трёхпанельный редактор: слева ваша версия, справа чужая, по центру результат. Кнопки «принять» для каждого фрагмента и «волшебная палочка» для неконфликтующих изменений.'],
    ['Git', 'Shelve и Changelists', 'Отложить изменения (Shelve) — аналог git stash с удобным просмотром. Changelists — разложить изменения по разным будущим коммитам.'],
    ['Git', 'Annotate', 'Правый клик по полям редактора → Annotate with Git Blame: кто и когда менял строку, переход к коммиту.'],
    ['Производительность', 'Run Anything', 'Двойной Ctrl: выполнить mvn-цель, gradle-задачу, запустить конфигурацию или команду без мыши.'],
    ['Производительность', 'HTTP Client', 'Файлы .http: запросы к своему API прямо из IDE, переменные окружений, проверки ответа скриптами. Удобно хранить рядом с кодом как документацию к API.'],
    ['Производительность', 'Покрытие тестами', 'Run with Coverage: подсветка покрытых и непокрытых строк в редакторе.'],
    ['Производительность', 'Режимы для показа', 'View → Appearance → Presentation Mode (крупный шрифт для демонстраций) и Distraction Free Mode (только код).'],
  ];
  const DEBUG = [
    ['Условные точки останова', 'Правый клик по точке останова → Condition: например <code>order.getId() == 42</code>. Остановится только на нужной итерации цикла.'],
    ['Точка останова-логгер', 'Снимите Suspend и включите Evaluate and log: IDE напечатает выражение в консоль без остановки — отладочный вывод без изменения кода.'],
    ['Точки останова на исключение', 'Ctrl+Shift+F8 → + → Java Exception Breakpoints: остановка в момент, когда бросается исключение (например, NullPointerException), а не когда оно уже долетело до лога.'],
    ['Точки наблюдения за полем', 'Field Watchpoint на поле: остановка, когда поле читается или меняется — ищем, кто «портит» значение.'],
    ['Вычисление и изменение значений', 'Alt+F8 — вычислить любое выражение в текущем контексте. В панели Variables — Set Value (F2), чтобы проверить гипотезу без перезапуска.'],
    ['Reset Frame', 'Кнопка Reset Frame (Drop Frame) в стеке вызовов возвращает выполнение к началу метода — повторить шаги, не перезапуская приложение.'],
    ['Отладчик стримов', 'На строке со стримом во время отладки — Trace Current Stream Chain: видно, какие элементы прошли через каждый filter и map.'],
    ['Асинхронные стеки и потоки', 'В окне Threads видны все потоки; асинхронные стектрейсы показывают, откуда была запущена задача CompletableFuture или @Async.'],
    ['Удалённая отладка', 'Запустите приложение с <code>-agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=*:5005</code> и подключитесь конфигурацией Remote JVM Debug — так отлаживают сервис в Docker. Не открывайте этот порт наружу в продакшне.'],
    ['Hot Swap', 'После изменения тела метода во время отладки — Build (Ctrl+F9): изменения подхватятся без перезапуска (только тела методов; новые поля и методы требуют перезапуска).'],
    ['Пометка объектов', 'В отладчике F11 на значении (Mark Object) даёт ему метку — объект легко узнать в других местах и использовать в условиях точек останова.'],
  ];
  // [постфикс, что получится]
  const POSTFIX = [
    ['.var', 'Создать переменную: <code>new Order().var</code> → <code>Order order = new Order();</code>'],
    ['.if', '<code>flag.if</code> → <code>if (flag) { }</code>'],
    ['.nn / .notnull', '<code>user.nn</code> → <code>if (user != null) { }</code>'],
    ['.null', '<code>user.null</code> → <code>if (user == null) { }</code>'],
    ['.not', 'Инвертировать условие: <code>isEmpty().not</code> → <code>!isEmpty()</code>'],
    ['.for / .fori', 'Цикл по коллекции или по индексу'],
    ['.sout', '<code>result.sout</code> → <code>System.out.println(result);</code>'],
    ['.return', '<code>value.return</code> → <code>return value;</code>'],
    ['.try', 'Обернуть выражение в try-catch'],
    ['.stream', '<code>list.stream</code> → <code>list.stream()</code>'],
    ['.opt', '<code>value.opt</code> → <code>Optional.ofNullable(value)</code>'],
    ['.cast', 'Привести тип: <code>((Type) expr)</code>'],
    ['.lambda', 'Обернуть выражение в лямбду'],
    ['.new', '<code>Order.new</code> → <code>new Order()</code>'],
    ['.throw', '<code>new IllegalStateException().throw</code> → <code>throw new …;</code>'],
  ];
  const LIVE = [
    ['psvm / main', 'метод main'], ['sout', 'System.out.println()'], ['soutv', 'печать переменной с именем'], ['soutm', 'печать имени метода'],
    ['fori', 'цикл for по индексу'], ['iter', 'цикл for-each'], ['ifn / inn', 'проверка на null / не null'], ['prsf', 'private static final'],
    ['psfs', 'public static final String'], ['thr', 'throw new'], ['St', 'String'], ['lazy', 'ленивая инициализация'],
  ];
  const SETUP = [
    ['Импорты на лету', 'Settings → Editor → General → Auto Import: Add unambiguous imports on the fly и Optimize imports on the fly — импорты всегда в порядке.'],
    ['Действия при сохранении', 'Settings → Tools → Actions on Save: переформатировать код и оптимизировать импорты при сохранении. Стиль — общий для команды через .editorconfig или схему форматирования в репозитории.'],
    ['Память IDE', 'Help → Change Memory Settings: для больших проектов 4–8 ГБ. Индикатор памяти — правый клик по статус-бару → Memory Indicator.'],
    ['JDK проекта', 'File → Project Structure (Ctrl+Alt+Shift+S): SDK проекта и уровень языка. IDE умеет скачать JDK сама (Add SDK → Download JDK).'],
    ['Lombok и процессоры аннотаций', 'Поддержка Lombok встроена. Если MapStruct или Lombok «не видны»: Settings → Build → Compiler → Annotation Processors → Enable annotation processing.'],
    ['Делегирование сборки', 'Settings → Build Tools → Maven/Gradle → Runner: запуск через Maven или Gradle даёт ту же сборку, что в CI; сборка IDE быстрее при разработке.'],
    ['Синхронизация настроек', 'Settings Sync: настройки, сочетания и плагины переносятся между компьютерами через аккаунт JetBrains.'],
  ];
  const PLUGINS = [
    ['Key Promoter X', 'Подсказывает сочетание клавиш, когда вы нажимаете кнопку мышью, — быстрый способ выучить клавиатуру.'],
    ['SonarQube for IDE (SonarLint)', 'Статический анализ и уязвимости прямо в редакторе, те же правила, что на сервере SonarQube.'],
    ['MapStruct Support', 'Навигация и автодополнение в маппингах MapStruct.'],
    ['Rainbow Brackets', 'Разноцветные парные скобки (как в блокноте кода этого справочника).'],
    ['String Manipulation', 'Преобразование регистра и стилей строк: camelCase, snake_case, экранирование.'],
    ['GitToolBox', 'Статус ветки, автоматический fetch, blame в строке.'],
    ['.ignore', 'Подсветка и генерация .gitignore и .dockerignore.'],
  ];

  function page(api, m) {
    const S = api.S(); S.ideaOs = S.ideaOs || (navigator.platform && /Mac/i.test(navigator.platform) ? 'mac' : 'win');
    const tab = m[1] || 'keys', esc = api.esc, $ = api.$;
    const TAB = [['keys', '⌨️ Сочетания'], ['tips', '💡 Приёмы и секреты'], ['debug', '🐞 Отладка'], ['templates', '✨ Постфиксы и шаблоны'], ['setup', '⚙️ Настройки и плагины'], ['train', '🎯 Тренажёр сочетаний']];
    const os = S.ideaOs, col = os === 'mac' ? 3 : 2;
    const kbd = s => s.split(/(\s\/\s)/).map(part => part.trim() === '/' ? ' / ' : part.split(/\+|(?<=Shift)\s(?=Shift)/).map(k => `<kbd>${esc(k.trim())}</kbd>`).join('<i>+</i>')).join('');
    let body = '';
    if (tab === 'keys') {
      const cats = [...new Set(KEYS.map(k => k[0]))];
      body = `<div class="idea-bar"><input class="gl-search" id="ideaQ" placeholder="Найти действие или сочетание…" autocomplete="off"></div>
        ${cats.map(c => `<div class="sec-title">${esc(c)}</div><div class="tbl idea-keys"><table><tbody>${KEYS.filter(k => k[0] === c).map(k => `<tr data-s="${esc((k[1] + ' ' + k[2] + ' ' + k[3] + ' ' + k[4]).toLowerCase())}"><td class="ik-a">${esc(k[1])}${k[4] ? `<div class="ik-n">${esc(k[4])}</div>` : ''}</td><td class="ik-k">${kbd(k[col])}</td></tr>`).join('')}</tbody></table></div>`).join('')}`;
    } else if (tab === 'tips') {
      const secs = [...new Set(TIPS.map(t => t[0]))];
      body = secs.map(s => `<div class="sec-title">${esc(s)}</div><div class="idea-cards">${TIPS.filter(t => t[0] === s).map(t => `<div class="idea-card"><b>${esc(t[1])}</b><p>${t[2]}</p></div>`).join('')}</div>`).join('');
    } else if (tab === 'debug') {
      body = `<div class="idea-cards">${DEBUG.map(t => `<div class="idea-card"><b>${esc(t[0])}</b><p>${t[1]}</p></div>`).join('')}</div>
        <div class="sec-title">Сочетания отладки</div><div class="tbl idea-keys"><table><tbody>${KEYS.filter(k => k[0] === 'Запуск и отладка').map(k => `<tr><td class="ik-a">${esc(k[1])}</td><td class="ik-k">${kbd(k[col])}</td></tr>`).join('')}</tbody></table></div>`;
    } else if (tab === 'templates') {
      body = `<p class="muted">Постфиксное автодополнение: пишете выражение, ставите точку и шаблон — IDE превращает его в конструкцию. Список и свои шаблоны: Settings → Editor → General → Postfix Completion.</p>
        <div class="tbl"><table><thead><tr><th>Постфикс</th><th>Результат</th></tr></thead><tbody>${POSTFIX.map(p => `<tr><td><code>${esc(p[0])}</code></td><td>${p[1]}</td></tr>`).join('')}</tbody></table></div>
        <div class="sec-title">Живые шаблоны (Live Templates)</div><p class="muted">Наберите сокращение и нажмите Tab. Свои шаблоны — Settings → Editor → Live Templates (например, заготовка теста Given-When-Then).</p>
        <div class="tbl"><table><thead><tr><th>Сокращение</th><th>Что вставит</th></tr></thead><tbody>${LIVE.map(p => `<tr><td><code>${esc(p[0])}</code></td><td>${esc(p[1])}</td></tr>`).join('')}</tbody></table></div>`;
    } else if (tab === 'setup') {
      body = `<div class="idea-cards">${SETUP.map(t => `<div class="idea-card"><b>${esc(t[0])}</b><p>${esc(t[1])}</p></div>`).join('')}</div>
        <div class="sec-title">Полезные плагины</div><div class="idea-cards">${PLUGINS.map(t => `<div class="idea-card"><b>${esc(t[0])}</b><p>${esc(t[1])}</p></div>`).join('')}</div>`;
    } else {
      body = `<div id="ideaTrain"></div>`;
    }
    api.main().innerHTML = `<div class="page wide idea-page"><div class="crumbs"><a href="#/">Главная</a> · Тренажёры</div>
      <h1 class="title">💡 IntelliJ IDEA</h1>
      <p class="subtitle">Горячие клавиши, приёмы и секреты главной IDE Java-разработчика. Сочетания — для раскладки по умолчанию; свои назначения видны в Settings → Keymap.</p>
      <div class="idea-top"><div class="page-tabs">${TAB.map(([k, l]) => `<a href="#/idea/${k}" class="${k === tab ? 'on' : ''}">${l}</a>`).join('')}</div>
        <div class="seg idea-os"><button data-os="win" class="${os === 'win' ? 'on' : ''}">Windows / Linux</button><button data-os="mac" class="${os === 'mac' ? 'on' : ''}">macOS</button></div></div>
      ${body}</div>`;
    api.$$('.idea-os button').forEach(b => b.onclick = () => { S.ideaOs = b.dataset.os; api.save(); page(api, m); });
    if ($('#ideaQ')) $('#ideaQ').oninput = e => { const f = e.target.value.toLowerCase().trim(); api.$$('.idea-keys tr[data-s]').forEach(tr => { tr.style.display = !f || tr.dataset.s.includes(f) ? '' : 'none'; }); };
    if (tab === 'train') train(api, col, kbd);
    api.$('.main').scrollTop = 0;
  }

  function train(api, col, kbd) {
    const esc = api.esc, S = api.S(); S.ideaTrain = S.ideaTrain || { ok: 0, n: 0 };
    const pool = KEYS.filter(k => k[2] !== k[3] || true);
    let qn = 0, ok = 0; const total = 10;
    const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    const order = shuffle(pool.slice()).slice(0, total);
    const next = () => {
      const box = api.$('#ideaTrain'); if (!box) return;
      if (qn >= total) {
        S.ideaTrain.ok += ok; S.ideaTrain.n += total; api.save();
        box.innerHTML = `<div class="flash-card"><div class="empty"><div class="big">🏁</div><h2>${ok} из ${total}</h2><p class="muted">За всё время: ${S.ideaTrain.ok} из ${S.ideaTrain.n}</p><button class="btn" id="itAgain">Ещё раунд</button></div></div>`;
        api.$('#itAgain').onclick = () => train(api, col, kbd); return;
      }
      const k = order[qn];
      const wrong = shuffle(KEYS.filter(x => x[col] !== k[col])).slice(0, 3);
      const opts = shuffle([k, ...wrong]);
      box.innerHTML = `<div class="train-bar"><i style="width:${qn / total * 100}%"></i></div><div class="flash-card quiz"><div class="fc-meta"><span>${esc(k[0])}</span><span>${qn + 1} / ${total} · верно ${ok}</span></div>
        <div class="fc-q">${esc(k[1])}</div><div class="qz-kind">◉ Какое сочетание?</div>
        <div class="qz-opts">${opts.map((o, i) => `<label class="qz-opt" data-i="${i}"><span class="qz-mark"></span><span class="qz-n">${i + 1}</span><span class="qz-t ik-k">${kbd(o[col])}</span></label>`).join('')}</div>
        <div class="fc-actions" id="itAct"></div></div>`;
      api.$$('.qz-opt', box).forEach(l => l.onclick = () => {
        if (box.dataset.done === String(qn)) return; box.dataset.done = String(qn);
        const pick = opts[+l.dataset.i], right = pick === k; if (right) ok++;
        api.$$('.qz-opt', box).forEach(x => { const o = opts[+x.dataset.i]; if (o === k) x.classList.add('ok'); else if (x === l) x.classList.add('bad'); });
        api.$('#itAct').innerHTML = `<button class="btn" id="itNext">${qn + 1 < total ? 'Дальше →' : 'Итог'}</button>${k[4] ? `<span class="muted">${esc(k[4])}</span>` : ''}`;
        api.$('#itNext').onclick = () => { qn++; next(); };
      });
    };
    next();
  }

  (window.APP_EXT = window.APP_EXT || []).push({
    id: 'idea', href: '#/idea', ico: '💡', t: 'IDEA', long: 'IntelliJ IDEA', desc: `${KEYS.length} сочетаний, приёмы, отладка, шаблоны и тренажёр`,
    re: /^#\/idea(?:\/([\w-]+))?$/, page,
  });
})();
