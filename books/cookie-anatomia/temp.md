
# ここから過去--------------------------


### 値の保存

例えば、あるユーザが example.com にある URL にアクセスするとき、リクエストが以下のようになったとする。


```http
GET / HTTP/1.1
Host: example.com
```

ここで、 example.com のサーバは以下のように任意の値を `Set-Cookie` ヘッダに付与する。


```http
200 OK HTTP/1.1
Set-Cookie: foobar
```

レスポンスを受信したブラウザは、 `Set-Cookie` に指定された値を保存し、 example.com に対する **次からのリクエストの `Cookie` ヘッダに保存した値を自動で付与** する。

```http
GET / HTTP/1.1
Host: example.com
Cookie: foobar
```

Cookie とは、一言で言えば「 **サーバがレスポンスで指定した値をブラウザが保存し、次からそのサーバに送信するリクエストに自動で付与する** 」というものだ。

値を保存し次から送る、そんな単純な機能の何が特筆するようなものなのだろうか?


### 設定値の保存

例えば example.com がサイトの見た目を変える「テーマ機能」に対応していたとしよう。ユーザは以下のような `<form>` でテーマを選択できる。

```html
<form method=post action=/settings/theme>
  <select name=theme>
    <option value=default>default</option>
    <option value=desert>desert</option>
    ...
  </select>
</form>
```

ユーザが選択したテーマは以下のようなリクエストでサーバに送信される。

```http
POST /settings/theme HTTP/1.1
Host: example.com
Content-Length: 12

theme=desert
```

サーバは、その設定を `Set-Cookie` で返せばブラウザに保存できる。

```http
200 OK HTTP/1.1
Content-Length: 256
Set-Cookie: theme=desert

<!doctype html>
<html>
  <head>
    <link rel=stylesheet href=desert.css>
    ...
```

これでブラウザは次からこの値を Cookie として送るため、サーバはテーマを変更した HTML を返すことができるのだ。

```http
GET /settings/theme HTTP/1.1
Host: example.com
Cookie: theme=desert
```

このように、ブラウザは保存した値を毎回送るだけで、どんな値を保存するかには決まりがない。サーバは基本的に好きな値を保存し、好きな用途で使うことができる。




逆にもし Cookie が無かったらどうやってテーマ機能を作ることができるだろうか?


### Cookie が無かったら

もちろん JS を使えばという話はあるが、それは一旦置いておき HTTP と HTML の範囲だけで考えてみよう。

ユーザがどのテーマにしたいのかは、最初の POST リクエストにあり、逆を言えばそこでしかわからない。

```http
POST /settings/theme HTTP/1.1
Host: example.com
Content-Length: 12

theme=desert
```

この POST のレスポンスに関してだけは、テーマを適用したレスポンスが返せるだろう。

```js
app('/settings/theme', (req, res) => {
  // body から theme を取り出す、無ければデフォルト
  const theme = req.body.theme || 'default'
  // html の生成時に body にあるテーマを使う
  const html = render(template, {theme})
  res.send(html)
})
```

しかし、これだけでは後続のリクエストにテーマの情報が無いため、ページを遷移したらデフォルトに戻ってしまう。

```http
GET / HTTP/1.1
Host: example.com

# テーマに関する情報が無い
```

そもそも HTTP のリクエストは Header と Body に分割でき、 Header は全てブラウザが自動で生成する。リクエストに何か情報を付与するには、 `<a>` か `<form>` を使い、 Body に対して行うのが基本だ。

最初のテーマ設定の POST は、まさしくユーザが `<form>` でテーマを選んだから付与されたものだ。ユーザではなくサーバが body に情報を付与するには `<form>` に hidden で隠すか、 `<a>` にクエリをつけるしかない。

例えば、次からのレスポンスで、リクエストを生成する全てのコントローラにテーマ情報を埋め込めば、できなくはないかもしれない。

```html
<a href=/>top</a>
<a href=/main?theme=desert>main</a><!-- クエリに含む -->
<a href=/help?theme=desert>help</a><!-- クエリに含む -->

<h1>Login</h1>
<form method=post action=/login>
  <input type=text name=username>
  <input type=password name=password>
  <input type=hidden name=theme value=desert><!-- hidden で隠す -->
</form>
```

しかし、別のサイトにある URL まで制御できないため、ユーザが外から遷移してきたり、自分で URL を直打ちしたような場合はやはりデフォルトに戻る。

Cookie はこのように、クライアントに毎回送ってほしい情報を保存し、かつ従来は介入できなかった **HTTP の Header 部分に毎回付与して送る** ことを、 **サーバが指示できる** という点が画期的なのだ。

```http
GET / HTTP/1.1
Host: example.com
Cookie: theme=desert # クライアントが毎回送ってくれる
```

他の例では、多言語対応の言語選択なども考えられるだろう。通常、言語選択はブラウザや OS に設定された設定を元に、ブラウザが Accept-Language ヘッダを生成してリクエストに付与する。例えば OS を英語に設定してると以下のようになる。

```http
GET / HTTP/1.1
Host: example.com
Accept-Language: en-US
```

これを元にサーバは英語のページを返すことができる。しかし、ユーザによっては「このページだけは日本語で見たい」というケースもあるだろう。この場合サイトは、言語選択の `<form>` を用意し、テーマ同様に Set-Cookie で保存させれば、次からクライアントはその Cookie を送ってくる。


```http
GET / HTTP/1.1
Host: example.com
Accept-Language: en-US
Cookie: theme=desert&lang=ja-JP
```

サーバは Cookie に lang があれば、それを優先してコンテンツを返せば、全てのページを最初から日本語で返すことができるわけだ。


### サーバでの設定保持

先の例では、設定情報をクライアントが Cookie に保存していた。

![クライアントが Cookie に設定を保存する](https://cacoo.com/diagrams/L0Jn5wPiobCrsSDy-4C99D.png)


Cookie への値の保存は、いくつか注意すべき点がある。

まず、あくまでもブラウザに保存をしているので、 **ブラウザが変わると設定は共有されない**。例えば PC で行った設定はモバイル端末には反映されない。

次に、詳細は後述するが **Cookie の値は消える場合がある**。するとせっかくユーザが行った設定が(サーバに残してない限り)消えてしまう。

また、ブラウザごとに **保存できる Cookie の上限** が設定されているため、設定が増え続けるとどこかであふれる可能性がある。

こうした設定値をブラウザに紐付けて保存するのではなく、ユーザに紐づけて保存することができれば、同じユーザが使っているとわかっている限り、どのブラウザからアクセスしても同じ設定を反映できるだろう。

そこで、ユーザが Alice であれば「Alice であること」を Cookie に保存し、「Alice に紐付いた値」はサーバに保存すれば要件は満たせる。

```http
GET / HTTP/1.1
Host: example.com
Accept-Language: en-US
Cookie: id=alice
```

```http
200 OK HTTP/1.1
Content-Length: 256
Set-Cookie: theme=desert

<!-- alice 用の設定を反映したコンテンツ -->
<!doctype html>
<html lang=ja>
  <head>
    <link rel=stylesheet href=desert.css>
    ...
```

```js
app.get('/', (req, res) => {
  // cookie から id を取り出す
  const id = req.cookie.id
  // id に紐付いた設定を取り出す
  const setting = db.getSetting(id)
  // 設定を反映したコンテンツを生成
  const html = render(template, setting)
  res.send(html)
})
```

![サーバがユーザに紐付け設定を保存する](https://cacoo.com/diagrams/L0Jn5wPiobCrsSDy-3F1BF.png)

これにより、どんなに設定が増えても Cookie にはキーとなる ID 値だけがあればよく、実際の値はサーバに保存される。サーバに保存できる量を増やせば設定はいくらでも増やせるし、 Cookie が消えてももう一度 ID だけ付与できれば設定は全て復元できる。


### ID から Nonce へ

サーバ側にユーザと紐付いた









### Session ID とログイン

### それを踏まえてカートを実装する
- Cookie Store でやるケース
- SessionID をふるケース
- Login をする前とした後のことも考える

<!--
### Cookie と Storage API

さて、ここまで読みながら「それ LocalStorage/IndexDb でいいじゃん」という点が気になってしかたが無い読者も居ただろう。そのとおり、 JS の Storage 系の API を用いれば、テーマ機能を実装する方法は選択肢が格段に増える。実際、テーマ機能を Cookie を使わず JS だけで実装するサイトもあるだろう。

TODO: document.cookie も含めて解説


TODO: 今ではあまり設定をそのまま保存することはなくなった
- クライアントで使う設定なら JS で良い
  - 特に SPA ではそう、少なくとも document.cookie にする理由はあまりない
  - クライアントでも使いサーバでも使いたいなら document.cookie でも良いが httpOnly なのと分ける
- そうでないならセッションに紐付けて保存すればいい
- ブラウザごとに変えたいなら
  - 構造化してブラウザに置いても良い
  - ブラウザにはブラウザ ID として別の key だけふり、サーバで持つのもあり

TODO: 実装方法ごとの比較

今回の用途の特徴を合わせて確認しておこう。

- theme はブラウザに保存しているので、ログインなどが必要ない
- ブラウザを変えると設定が変わる。逆を言えばブラウザごとに設定を変えられる
- Cookie の値が消えたらデフォルトに戻る
- ブラウザの Cookie をいじれるユーザは、そこから別の値に変えることもできる

この特徴は後ほど別の方法と引き合いに出す。
-->


### クライアントの識別

先の例では Cookie にテーマや言語など具体的な値を保存したが、 Cookie にはもっと重要なユースケースがある。それがクライアントの識別だ。

例えば、ユーザ Alice, Bob が、それぞれ同じように example.com にアクセスするとき、両者のリクエストは以下のようになる。

```http
GET / HTTP/1.1
Host: example.com
```

サーバが取得できる情報はこれだけなので、このリクエストが Alice, Bob どちらからのものかは識別できない。これでは、例えばページの右上にユーザ名を表示したり、ユーザが買い物中の

これでは、ページ内にアクセスしてきたユーザの名前を埋め込むといったこともできません。


```http
HTTP/1.1 200 OK

<!doctype html>
<h1>${name} さんこんにちは</h1><!-- ここに埋め込む名前がわからない -->
```


## クライアント追跡の方法

こうしたユースケースに対する実装は、条件をつければできなくはありません。

1 つの方法としては、 URL のクエリや HTML の hidden 属性に、情報を隠すといった方法があります。

たとえば、ピザをカートに足した A には、その後表示される全てのページ内のリンクに `?cart=pizza` をつけることで、どのページに行ってもカートにピザを表示できる。

しかし、これではユーザ毎に URL が変わってしまい、例えば A が今表示されている URL を B に slack で送ったら、それを開いた B は身に覚えのないピザがカートにあるという状態になる。

こうした、「Request になんらかの情報が無いと区別ができない」という問題を解決するために、「サーバが一度レスポンスで返した情報を、クライアントが常に送ってくれる」という特別な方式が生み出された。

それが Cookie のモチベーションである。


## Cookie の挙動概要

Cookie はサーバの `Set-Cookie` ヘッダで付与される。値は `key=value` の形で付与される。

そこで、 ピザをカートに入れた A には


```http
Set-Cookie: cart=pizza
```

コーラをカートに入れた B には


```http
Set-Cookie: cart=coke
```

を返す。

すると、クライアントはその値を覚え、次から同じサイトのリクエストに対して **自動で常にその値を返す** 。

これにより、 A のリクエストは


```http
GET / HTTP/1.1
Host: example.com
Cookie: cart=pizza
```

B のリクエストは


```http
GET / HTTP/1.1
Host: example.com
Cookie: cart=coke
```

これによって、二つのリクエストが区別できるようになった。

サーバは、リクエストを見るだけで、カートの中身を把握できる。


## Cookie の制限

しかし、この実装では Cookie の持ついくつかの制限によって、問題がいくつか残る。

- ユーザがカートに追加するたびに Set-Cookie する必要がある。
- Cookie はクライアントに残るので、クライアントが変わると引き継げない。
- 多くのサイトが Cookie を使い、増えてくると古い Cookie は消える。
- Cookie の長さには制限がある。

そこで、カートの中身を Cookie に入れ込むのではなく、代わりになんらかの ID を生成しそれを入れておくという方法がよくとられる。


## Session ID へ

例えば、 A には `31d4d96e407aad42` という ID を振る。

サーバでは `31d4d96e407aad42` をキーにして、 DB に A のカートの中身を入れる。

そして A のレスポンスに以下を返す。


```
Set-Cookie: ID=31d4d96e407aad42
```

すると A は Cookie で毎回この ID を送るので、サーバは紐づいた A のカートの中身を返すことができる。


```
GET / HTTP/1.1
Host: example.com
Cookie: ID=31d4d96e407aad42
```

すると、クライアントが覚えるのは ID だけで済む。


## Login と Session ID

もし、 A がカートに商品をいくつか入れた状態で、この Cookie が消えてしまった場合を考えて見る。

A は Cookie を送れないので、サーバは `31d4d96e407aad42` に紐づいたカートを返すことはできない。

Cookie が無い人が A であることを知るためにはどうするか。

そこで行うのが認証、つまりログインの操作になる。

1. ログインで A のアカウント/パスワードを入力してもらう
2. A を正しく認証できたサーバは、 A のために ID を振る
3. A に Set-Cookie で ID を返す
4. A は毎回 Cookie で ID を送ることで、自分が A であることをサーバに伝える

その後 A のカートは、この ID に紐づけてサーバに保持することで、前述の通りカートの中身を A に返せる。

もし A がブラウザを変えたり、ブラウザの中で Cookie が消えたら、再度認証する。

1. ログインで A のアカウント/パスワードを入力してもらう
2. A を正しく認証できたサーバは、すでに A に振られた ID を返しても大丈夫とわかる
3. A に Set-Cookie で ID を返す
4. A は毎回 Cookie で ID を送ることで、自分が A であることをサーバに伝える
5. A は以前に追加していたカートも取得できる

つまり、この ID は単にカートのキーという役割ではなく、その人が **ログイン済みの A** であるということを示すキーとなる。

そして、その ID を Cookie で送って来た人は A であるから、カートの中身も購入履歴もフレンドメッセージも返すことができる。

その後 A の行った操作(カートへの追加 etc)も、全て A の ID に紐づけてサーバ側で保存すればいい。

こうして **ログイン済みの A** であることを知ることができる ID を **Session ID(SID)** と言い、クライアントが Session ID を送って来てる期間を Session という。

Cookie が A であることを示すということは、 **もし B がこの SID を盗み、 Cookie に付与して送ると、 A に成り済ませる** ことを意味する。

だから、 **Cookie が盗まれることは決してあってはいけない**。


## Cookie の重要性

盗まれなくても、推測できてしまうと問題になる。

例えば、 SID は A に関する情報(名前や、ありえそうなカートの状態 etc)などをハッシュ関数にかけただけのものでは、ハッシュ関数がバレた時に、 Cookie が偽造できてしまう。

そこで、 通常は、十分に安全とされる乱数生成機から値を取得し、 Session ID に使う。

こうした値を **Nonce** という。


## Cookie と Stateless HTTP

まず、そもそも Cookie という発想が必要だっ理由から振り返る。

ここでは例として、日曜雑貨や食品などが買える EC サイト https://ec.example (以下 EC) を考える。 EC ではカート機能があり、そこに商品を入れてから決済を行う。

alice がカートにリンゴを一個追加するリクエストは以下のようになるだろう。


```http
POST /cart HTTP/1.1
Host: ec.example
Origin: https://ec.example
Content-Length: TODO

item=apple&count=1
```


## Session Cookie と Setting Cookie

Cookie は非常に柔軟な仕様であるため、様々なユースケースで利用される。まずは基礎として、そのユースケースを以下の 2 つに大別して解説する。

- Session Cookie
- Setting Cookie


## Cookie のユースケース

Cookie は非常に柔軟な仕様であるため、様々なユースケースで利用されます。今回は、この Cookie の挙動と制御方法を仕様を元に解説します。


### セッションの維持

まず簡単に Cookie のおさらいをします。

Cookie の最も基本的なユースケースが「セッションの維持」です。ユーザからの最初のリクエストに対してランダムな値を付与し、それが送られてくることを元にリクエストを送ってきたユーザを区別します。

この用途でサーバから Cookie を付与する場合は、値を推測しにくい十分に安全な乱数から生成した値を用います。キーは任意ですが今回は Session ID を略した SID とします。


```http
# 紙面の都合上短い値にしている
Set-Cookie: SID=q1w2e3r4t5
```

SID を付与すれば、クライアントは識別できますが、その「送信者が誰であるか」まではわかりません。そこで、 「**SID に対してユーザのアカウントを紐付ける行為**」 がログイン認証と言えるでしょう。


### Credential としての Cookie

ユーザ Alice が、ログイン画面のフォームからログインしたとします。


```http
POST /login HTTP/1.1
Host: example.com
Content-Length: 31

username=alice&password=YWxpY2U
```

これをサーバ側で認証し、 Alice のための SID を生成し付与します。


```http
HTTP/1.1 200 OK
Content-Type: text/html
Content-Length: 1024
Set-Cookie: SID=q1w2e3r4t5

<html>
<body>
<title>ようこそ Alice</title>
...
```

この後は、`SID=q1w2e3r4t5`を送ってくるのは、 Alice であることがわかります。

Cookie から Alice であることを判断するということは、 Alice の Cookie が盗まれると、攻撃者は同じ Cookie を送ることで Alice に成りすまして SNS に投稿したり、 EC サイトの購入履歴を盗み見ることができてしまうということです。

Cookie には他にもユースケースがありますが、最も多いのがこの Credential としてのユースケースであり、このことから、 Cookie を利用するサービスは、絶対に Cookie が漏洩/改ざんされないように対策を行い、ユーザを守る必要があります。

ここからは、 Cookie の挙動により実現する攻撃と、その対策方法などについて解説していきます。


## Session Fixation 攻撃


### Cookie を付与するタイミング

EC サイトなどでは、ログインする前からカートに商品を追加でき、決済の直前でユーザ認証が行われるようなフローがよくあるでしょう。

この場合、サービスへの最初のアクセスで「セッションを維持するためだけの Cookie」を付与することになります。


```http
HTTP/1.1 200 OK
Content-Type: text/html
Content-Length: 1024
Set-Cookie: SID=q1w2e3r4t5

<html>
...
```

これにより、他のユーザとの区別が可能になり、ユーザごとにカートを用意することができます。

決済をするためには、ユーザを認証する必要があるため、そこまでのセッションとアカウントを紐づけます。


```http
POST /login HTTP/1.1
Host: example.com
Content-Length: 31
Cookie: SID=q1w2e3r4t5

username=alice&password=YWxpY2U
```

`SID=q1w2e3r4t5` だった人が Alice だと判明するため、次からは「この SID を送ってきたら Alice からだ」とわかるでしょう。

しかし、その実装には大きな落とし穴があります。


### SID の改ざん

もし Alice が送ってきた SID が、サーバによって付与されたものではなく、悪意のある攻撃者によって Alice のクライアントに埋め込まれた値だったらどうでしょう?


```http
POST /login HTTP/1.1
Host: example.com
Content-Length: 31
# 攻撃者によって埋め込まれた値
Cookie: SID=bad-cookie

username=alice&password=YWxpY2U
```

認証が正しく行われたことで、この`SID=bad-cookie`をその後 Alice と扱ってしまうと、埋め込んだ攻撃者はこの SID の値を知っているため、認証が通った直後に Alice に成り済ますことができてしまいます。

これを**Session Fixation 攻撃**と呼びます。

基本的な対策は「認証が終わったら SID を再生成する」です。上記のログインリクエストに対しても新しい SID を返せば、攻撃者の Cookie を用いたなりすましは実現しません。


```http
HTTP/1.1 201 Created
Set-Cookie: SID=y6u7i8o9p0
...
```

「Alice のクライアントに任意の Cookie を保存するなんてできるのか?」と思うかもしれませんが、それがどう可能かは後ほど解説します。


## CSRF 攻撃

Alice は example.com にログイン済みで SID の Cookie を保持している場合、全く別の Origin である example.co.jp などから画面遷移しても、そのリクエストには Cookie が自動で付与されます。もし、ここで example.com に Cookie が送信されなかった場合、 example.com に遷移してもログイン済みとはみなされない、といったことが起こってしまい不便です。

しかし、この「他の Origin へも自動で送信される」という仕様には注意が必要です。


### 正規フォームからのリクエスト

例えば example.com が以下のような`<form>`からメッセージの投稿が可能だったとします。


```html
<!-- example.com 上の正規の投稿フォーム -->
<form action=/messages method=post>
  <input type=text name=message>
  <button type=submit>post</button>
</form>
```

このとき送信されるリクエストは、 Cookie も付与され以下のようになります。


```http
POST /messages HTTP/1.1
Host: example.com
Content-Type: application/x-www-form-urlencoded
Content-Length: 13
Cookie: SID=q1w2e3r4t5y6

message=hello
```


### 攻撃フォームからのリクエスト

ここで攻撃サイト attack.example に以下のような `<form>` を設置した場合を考えましょう。


```html
<!-- attack.example 上の攻撃用投稿フォーム -->
<form action=https://example.com/hmessages method=post>
  <input type=text name=message>
  <input type=hidden value="attack message">
  <button type=submit>click me!</button>
</form>
```

action 属性の URL を example.com にし、攻撃者が投稿させたい値を hidden 属性で隠しています。ユーザにはボタンしか見えておらず、これをうっかりクリックさせると以下のようなリクエストが送信されます。

(実際は、 JS で submit するなどより効率的な攻撃方法は色々あります)


```http
POST /messages HTTP/1.1
Host: example.com
Content-Type: application/x-www-form-urlencoded
Content-Length: 22
Cookie: SID=q1w2e3r4t5y6

message=hello
```

注目すべきは、攻撃者のサイトからのリクエストにも関わらず、 Cookie が付与されている点です。もし example.com が、「正しい Cookie が送られて来ていること」だけを元に、リクエストを受理してしまうと、ユーザが意図しない投稿が行われてしまうことになります。これが CSRF(Cross Site Request Forgeries)攻撃です。


### One Time Token による対策

基本的な対策は、各`<form>`の hidden 属性に One Time Token を埋め込み、それが送られてきているときだけ、リクエストを受け入れるようにします。


```html
<!-- example.com 上の正規の投稿フォーム -->
<form action=/messages method=post>
  <input type=text name=message>
  <input type=hidden name=csrf_token value=p0o9i8u7y6t5r4e3w2q1>
  <button type=submit>post</button>
</form>
```


```http
POST /messages HTTP/1.1
Host: example.com
Content-Type: application/x-www-form-urlencoded
Content-Length: 45
Cookie: SID=q1w2e3r4t5y6

message=hello&csrf_token=p0o9i8u7y6t5r4e3w2q1
```

token が送られてくることにより、攻撃者が偽装した `<form>` からのリクエストでないことが確認できるため、攻撃を防ぐことができます。


## Timing 攻撃

次は、 SNS におけるブロック機能を考えてみましょう。攻撃者は、 Alice が誰をブロックしているかを調べたいと考えています。

そこで攻撃者は Alice を以下のような JS を仕込んだサイトに誘導したとします。


```js
function timing_attack(username) {
  img = new Image()
  t1 = performance.now()
  img.onerror = () => {
    t2 = performance.now()
    // block していれば速く
    // block していなければ遅い
    console.log(t2-t1)
  }
  img.src = `https://sns.example.com/#{username}`
}
```

この JS は、 SNS のユーザごとのページを取得し、その取得にかかる時間を調べています。 Alice が SNS にログイン済みであればリクエストには Cookie が付与され、 Alice がブロックしていれば定形画面が返り、ブロックしていなければそのユーザのタイムラインが取得されます。

取得結果自体を見ることは出来ませんが、通常ユーザのタイムラインを取得するほうが、ブロックの定形画面よりも速いため、ユーザを変えならが取得をすればブロックしているユーザがわかってしまいます。これが Timing Attack の基本的な発想です。 2018 年には、実際に Twitter で発見され[Silhouette(シルエット)攻撃](https://blog.twitter.com/engineering/en_us/topics/insights/2018/twitter_silhouette.html)と呼ばれました。

この攻撃は、 GET によるアクセスのため、 CSRF のように Token を付与することも難しく、ブロックされている場合でも、されていない場合と同程度にレスポンスを遅延させるといった方法でしか対処することが難しいのが現状です。
