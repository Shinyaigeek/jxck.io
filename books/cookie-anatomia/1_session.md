---
title: "Session ID と Credential"
emoji: "📝"
type: "tech"
topics: ["cookie", "web"]
published: false
---

## Cookie "そのもの" の挙動と用途

Cookie は Session の維持や Tracking など、何らかの用途があって使用されるが、その用途と Cookie 自体の性質を混ぜたまま理解をするのは危険だ。

そこで、まずは Cookie そのもの挙動を確認し、そこから代表的な用途について見ていく。


## ショッピングカート

EC サイト(https://ec.example) の **ショッピングカート** の実装を考えてみよう。ただし、ここでは JS を使うと話がややこしくなるため、まずは JS を使わずに話を進める。

商品ごとに以下のような `<form>` があり、 hidden に商品 ID が隠してあるため、ユーザは商品の横にある個数を選び Submit するとカートに追加できるとする。 product_id が 1000 の商品の `<form>` は以下のようになる。


```html
<!-- 解説のため簡略化している -->
<form method=post action=/cart/items>
  <input type=hidden name=product_id value=1000>
  <label>個数: <input type=number name=count value=1></label>
  <button type=submit>カートに追加</button>
</form>
```

発生するリクエストは以下のようになるだろう。


```http
POST /cart/items HTTP/1.1
Host: ec.example
Content-Length: 23

product_id=1000&count=1
```

サーバはこれを受け取ったらまた一覧画面を返し、ユーザは買い物を続行する。この `product_id` と `count` の組が蓄積されるのがカートの実態だ。

ところが、これではカートが実装ができない。

例えば複数のユーザが同時に買い物をしているなら、カートはユーザごとに分ける必要があるが、リクエストだけを見ても誰がカートに入れようとしているのかを **区別** できないのだ。

![TODO](https://cacoo.com/diagrams/L0Jn5wPiobCrsSDy-33EAD.png)


```http
# だれが買ったのかを示す情報がなにもない
POST /cart/items HTTP/1.1
Host: ec.example
Content-Length: 23

product_id=1000&count=1
```

ここで Cookie を利用することができる。


### ユーザの区別

まずユーザが最初に EC アクセスしてきた時、リクエストには Cookie が無いため、「このユーザは初めてここにきた」ということがわかる。


```http
GET / HTTP/1.1
Host: ec.example
# Cookie ヘッダが無い
```

ここで、サービスはこのユーザに対してランダムで一意な ID を生成し、それを Set-Cookie で返す。ここではその Cookie 名を session_id としよう。


```http
200 OK HTTP/1.1
Content-Length: 256
Set-Cookie: session_id=YWxpY2U

<!doctype html>
...
```

すると、このユーザが買い物を開始しカートに追加した場合、リクエストにはこの Cookie が自動で付与されてくる。


```http
# Cookie が付与されているので他のユーザと区別できる
POST /cart/items HTTP/1.1
Host: ec.example
Content-Length: 23
Cookie: session_id=YWxpY2U

product_id=1000&count=1
```

付与する ID をユーザごとに変えておけば、ユーザを区別できるため、 ID ごとにカートをサーバに確保すれば、適切なカートに商品を追加することができるのだ。

![TODO](https://cacoo.com/diagrams/L0Jn5wPiobCrsSDy-25199.png)


### ユーザの識別

session_id によって「このリクエストとこのリクエストは別の人だ」という **区別** ができるようになった。しかし、 EC では最終的に会計をする際には「買おうとしてるのは誰か」を知る必要がある。

そこで、多くの EC サイトはどこかの段階で「ログイン認証」を行い、ユーザが誰であるかを認証する。パスワード認証であれば、ログイン画面からのリクエストは以下の様になるだろう。


```http
POST /login HTTP/1.1
Host: example.com
Content-Length: 32
Cookie: session_id=YWxpY2U

username=alice&password=xxxxxxxx
```

ユーザ名とパスワードから、まさしく登録済みの Alice であることがわかれば、そこまでの買い物は Alice がしていたことがわかり、ユーザが **識別** できる。

もちろん、先にログインをしてからでないと買い物を始められない場合は、 session_id を振った時点でユーザ名が判別しているかもしれないが、多くの EC はログインする前、もっと言えばアカウントを作る前からカートに追加できる実装も多い。決済の直前までは、ユーザの区別は必要だが、識別する必要はないからだ。

このことから、 **ログイン認証とは session_id にアカウントを紐付ける行為** だと言える。

そして、多くのサイトではログインやアカウントの有無に限らず、とにかく最初のアクセス(Cookie の無いリクエスト)に対して session id を付与し、なんらかの区別に使用している場合が多い。

注意点として、ログイン前にはやむを得ずランダムな値にしていたが、ログイン後識別ができたからと言って、ここにユーザ名やユーザ ID を使用してはいけない。


```
# 絶対に駄目
Set-Cookie: alice
```

確かに、 Cookie としてアカウント名を送ってくれば、誰だか識別もできるしカートも区別できる。しかし、 Cookie はあくまでブラウザに保存されている値であるため、クライアントが簡単に書き換えることができてしまうのだ。


```
# alice が bob の買い物かごや購入履歴を覗けてしまう
Cookie: bob
```

あくまで Cookie には、他のユーザと区別できるよう一意で、推測できないランダムな値(Nonce)を付与し、サーバ側でその値に対してユーザアカウントを紐付けるというのが一般的な実装だ。

![TODO](https://cacoo.com/diagrams/L0Jn5wPiobCrsSDy-3F374.png)


## Session とは何か

一般的に、このユーザを区別するために付与する ID を session_id と言ったが、そもそも Session とはなんだろうか?

これを理解するに session_id を使わないでカートを実装してみよう。

そもそも、カートを実装するためには、サーバが以下の 2 つのリクエストを受け取った時、それが同じ Alice から来たものなのか、 Alice / Bob  別の 2 人から来たものなのか区別できる必要がある。でなければ、サーバに用意したどのカートに入れて良いのかわからない。


```http
# 1 つ目の追加リクエスト
POST /cart/items HTTP/1.1
Host: ec.example
Content-Length: 23

product_id=1000&count=1
```


```http
# 2 つ目の追加リクエスト
POST /cart/items HTTP/1.1
Host: ec.example
Content-Length: 23

product_id=3000&count=2
```

リクエストを区別できないなら、サーバがカートを持たないという方法を考えてみよう。

ここには主に 2 つの方法がある。

- hidden での実装
- cookie での実装


### hidden を用いたカート実装

カートへの追加は以下のような `<form>` だった。ユーザが入力するのは個数だけで、 product_id はサービスの都合なのでユーザには入力させないように hidden で隠している。


```html
<form method=post action=/cart/items>
  <input type=hidden name=product_id value=1000>
  <label>個数: <input type=number name=count value=1></label>
  <button type=submit>カートに追加</button>
</form>
```


```http
POST /cart/items HTTP/1.1
Host: ec.example
Content-Length: 23

product_id=1000&count=1
```

このリクエストを受けたサーバは「このユーザは 1000 を 1 つ追加した」という情報を覚えるのではなく、その情報をさらに全ての `<form>` に hidden で入れてた HTML を生成し返してしまうのだ。


```html
<form method=post action=/cart/items>
  <input type=hidden name=product_id value=3000>
  <label>個数: <input type=number name=count value=3></label>

  <!-- カートに相当する情報 -->
  <input type=hidden name=cart value="1000:1">

  <button type=submit>カートに追加</button>
</form>
```

すると、次のカート追加リクエストは以下のようになる。


```http
POST /cart/items HTTP/1.1
Host: ec.example
Content-Length: 23

product_id=1000&count=1&cart=1000:1
```

これを繰り返していると、最後に決済する際のリクエストには、購入したい全ての商品がリクエストに載ってやってくることになる。加えて認証情報を送ってしまえば、「誰が何を何個買おうとしたのか」を 1 リクエストで送っているのと同じ状態になるのだ。


```http
POST /purchase HTTP/1.1
Host: ec.example
Content-Length: 256

# わかりやすく改行している
username=alice&
password=xxxxx&
cart=1000:1
cart=3000:3
cart=5000:2
....
```

これにより、サーバはカートのためにクライアントを識別する必要がないだけでなく、 **何かを覚えておく必要が無い** のだ。

とんでもない実装に思えるかもしれないが、実は本来 HTTP とはこうやって使うところから始まっている。 HTTP は一回のリクエストとレスポンスで完結するやり取りの繰り返しによって次々にページを取得していくのが基本だ。

カートのように、「さっき 1000 を 1 つ追加した」という前提で「次は 3000 を 3 つ追加する」という、以前のリクエストと連続(依存)関係を持ったリクエストを繰り返すことは、もともとの HTTP の発想になはい。

この「サーバが何も覚える必要が無い」ことは「サーバに状態を持たないで良い」と言い換えることができ、英語では **State(状態が)less(無い)** という。

もし読者が、例えば HTTP API を持っているどこかのサービスを使った経験があれば、大抵それらは一つのリクエストに JSON などであらゆる情報を詰め込んで、一回のリクエストで操作が完結するように作られているだろう。

仮に、ここでいう決済の API である `/purchase` が、 JSON API として以下のように購入する商品のリストをまるっと受け入れる作るになっていても、そこまで違和感は無いのではないだろうか?(認証は別として)


```js
fetch('/purchase', {
  method: 'post',
  content-type: 'application/json',
  body: JSON.stringify({
    username: 'alice',
    password: 'xxxxx',
    cart: [
      {product_id: 1000, count: 1}
      {product_id: 3000, count: 3}
      {product_id: 5000, count: 2}
    ]
  })
})
```

そして本来 HTML は、ユーザがこうしたリクエストを生成するのを補助するためのコントローラだ。最終的なリクエストを生成するために、その過程で HTML がリクエストを生成できるように更新して返していく、というのは HTTP の作法としてはそこまで間違ってはいない。それによりサーバは Stateless を保てるからだ。

しかし、発想は良さそうとしても、この方針で実装し切るのはむずかしい。

例えば、どこかで別のページに遷移したら、その瞬間 hidden で隠された情報がページとともに消えるからだ。従って、こうした方法は部分的に使われることはあっても、カートの実装に使われることは少なくとも主流では無い。


### cookie を用いたカート実装

最初に Cookie に session_id を付与することで、サーバがカートを持ち、そこで覚えておくという話をした。

「サーバが覚えておく」ということは「サーバが状態を持つ」ということだ。これを Stateless と対に **State(状態が)ful(有る)** という。

しかし、 Cookie を用いてもサーバが Stateless を保つことは可能だ。リクエストが来るたびにそれを `Set-Cookie` に追加して返し、カート(状態)を Cookie に持てば良い。


```http
POST /cart/items HTTP/1.1
Host: ec.example
Content-Length: 23
# 最初は Cookie が無い

product_id=1000&count=1
```


```http
201 Created HTTP/1.1
Set-Cookie: cart=1000:1 # カート相当の情報を Cookie で返す
```

これを繰り返して行けば、カートの中身は全て Cookie にあるので、最後の決済リクエストではアカウントだけ送れば良い。リクエストの持つ情報自体は hidden で生成したリクエストと等価だ。


```http
POST /purchase HTTP/1.1
Host: ec.example
Content-Length: 256
Cookie: cart=1000:1,3000:3,5000:2...

username=alice&password=xxxxx
```

この方法なら、 hidden と違いどのページに移ってもカートの中身が保持されるため、実装の制約が少なくなる。

実際、このように情報をサーバで保持するのではなく Cookie に入れることで Stateless を保つというオプションを持つフレームワークもある。このように平文ではなく、何かしらのエンコード方法で保持するものが多い。

しかし、この実装にもいくつか問題がある。

まず、今回はカートの中身なので良いかもしれないが、前述のようにユーザによって簡単に書き換えができてしまうと問題になる値もあるだろう。(そこでこの値を平文ではなくサーバの持つ鍵で暗号化するという方法もある)。

次に、 Cookie の値には長さの制限があり、無尽蔵に入れていくと頭打ちになる。そして、他のサイトでも Cookie が使われている以上、ブラウザ全体で Cookie の保存領域が埋まれば、古いものから消えていくことになる。

TODO: Cookie limit in spec

なにより、値がブラウザに保存されている以上ブラウザを変えると値が継続されない。モバイルで買い物していたカートを引き続き PC で見たいといったことが、この方法ではできないのだ。

したがって、この方法もカート実装として主流とは言い切れない。

(しかし、この発想は他にも用途があるため、それについては後述する)


### Session Cookie を用いたカート実装

さて、 hidden や cookie を用いると Stateless な実装ができることは解説した。しかし実際には最初に解説した session_id を付与しサーバにカートの情報を保持する実装が多い。

前述のように、 Cookie に保存するのは session_id のみにし、サーバ側には session_id に紐付けて情報を保存する方法は、クライアントがリクエストをするたびにサーバに操作の結果を蓄積していることになる。最初に product_id 1000 を 1 つ追加すればサーバにはその情報が残り、次のリクエストは「それを踏まえた上で」別の商品を追加していることになり、これはサーバに **状態** があることを意味している。

このようにサーバに状態を持つ実装方法を、 Stateless と対比して **state(状態が)ful(ある)** と言う。 Cookie に付与したのは、この状態を識別するための id であり、状態が生成されてから行うやり取りを **Session** という。よってこの Cookie は Session ID と呼ばれ、近年の Web サービスの多くは、サーバに最初に接続した時に Session ID を付与することで Session を確立し、そこで Stateful なやり取りを行う実装を採用していることが多い。

これを踏まえてもう一度 Stateful なカートの実装を振り返ろう。

まず、最初にクライアントが接続してきたときは、 Session を確立するための Session ID を Cookie に付与する。


```http
GET / HTTP/1.1
Host: example.com
```


```js
app.get('/', (req, res) => {
  // cookie から session_id を取り出す
  const session_id = req.cookie.session_id
  if (session_id === undefined) {
    // Session オブジェクトを生成
    const session = SessionStore.new()
    // その id を Cookie に付与
    res.headers.add('set-cookie', {session_id: session.id})
  }
  const html = render() // html を生成
  res.send(html)
})
```


```http
200 OK HTTP/1.1
Content-Length: 256
Set-Cookie: session_id=YWxpY2U

<!doctype html>
...
```

この時点でサーバには Session ID に紐付けた保存領域を確保し、そのセッションの中で必要な情報を保存する。今回はカートの情報がここに入るが、実際はカート以外に色々なものを入れる。

![TODO: 図4](https://cacoo.com/diagrams/L0Jn5wPiobCrsSDy-609BB.png)

ユーザがカートに追加するとそのリクエストは以下のようになる。何個追加してもその時追加した商品の情報だけを送れば良い、以前追加したものはサーバに保存されているからだ。


```http
# Stateful な処理
POST /cart/items HTTP/1.1
Host: ec.example
Content-Length: 23
Cookie: session_id=YWxpY2U

product_id=1000&count=1
```


```js
app.post('/cart/items', (req, res) => {
  // cookie から session_id を取り出す
  const session_id = req.cookie.session_id
  // id に紐付いた Session オブジェクトを取得
  const session = SessionStore.get(session_id)
  // リクエストから商品を取得
  const product_id = req.body.product_id
  const count      = req.body.count
  // Session に追加
  const cart = session.get('cart')
  cart.add(product_id, count)
  session.set('cart', cart)
  // html を生成
  const html = render()
  res.send(html)
})
```

この Session は、 session_id によって他のユーザが確立している Session と区別できる。しかし、まだ誰がこの Session を実行しているのかはサーバは知らない。

会計の前には認証を行うことで、 Session にアカウント情報を紐付ける。これにより、誰の Session だったのかを識別でき、決済に進むことができる。


```http
POST /login HTTP/1.1
Host: example.com
Content-Length: 32
Cookie: session_id=YWxpY2U

username=alice&password=xxxxxxxx
```

これが session_id を用いたカートの実装で、あり Cookie の代表的な使い方だ。

こうしたことが可能になったことによって Web の利用範囲が格段に増えた、理由は、 「Set-Cookie によって付与された値を、次から Cookie で自動で送る」というこの単純な挙動が、 **本来は Stateless を前提として設計された HTTP に Stateful な処理を可能にしてしまった** からだ。

:::details HTTP と Cookie の関係
HTTP の仕様は [RFC7231](https://tools.ietf.org/html/rfc7231) に定義されており、その冒頭は以下の文から始まる。

> The Hypertext Transfer Protocol (HTTP) is a stateless application-level protocol for distributed, collaborative, hypertext information systems.

そして、 Cookie の仕様は [RFC6265](https://tools.ietf.org/html/rfc6265) に定義されており、そのタイトルはまさしく "HTTP State Management Mechanism" で以下の文から始まる。

> This document defines the HTTP Cookie and Set-Cookie header fields.  These header fields can be used by HTTP servers to store state (called cookies) at HTTP user agents, letting the servers maintain a stateful session over the mostly stateless HTTP protocol.

HTTP は本来は GET で文書を取得して終わりだったため Stateless で良かったが、 `<form>` から POST をし始めチャットなどができるようになった。すると毎回チャットにユーザ名やメールアドレスを入れないで済むように、それらを保存できるように Cookie が作られたのが始まりと聞いたことがある。 RFC の冒頭からも Stateless だった HTTP と、そこに Stateful をCookie が持ち込んだという構図が読み取れるだろう。
:::


## 設定の保存

Cookie には session_id 以外入れてはいけないわけではない。他で使われる例は、ユーザごとに違う設定値の保存がある。

例として、多言語対応の言語選択を考えてみよう。通常、言語選択はブラウザや OS に設定された設定を元に、ブラウザが `Accept-Language` ヘッダを生成してリクエストに付与する。例えば OS を英語に設定してると以下のようになる。


```http
GET / HTTP/1.1
Host: example.com
Accept-Language: en-US
```

これを元にサーバは英語のページを返すことができる。しかし、ユーザによっては 「OS 設定は英語だけど、このページだけは日本語で見たい」というケースもあるだろう。そこで言語選択の `<form>` を提供するサイトもある。


```html
<form method=post action=/settings/lang>
  <select name=lang>
    <option value=en-US>en-US</option>
    <option value=ja-JP>ja-JP</option>
    ...
  </select>
</form>
```


```http
POST /settings/lang HTTP/1.1
Host: example.com
Content-Length: 10

lang=ja_JP
```

この、選択結果をでページの言語を設定しつつ Set-Cookie で保存すれば良い。


```http
200 OK HTTP/1.1
Content-Length: 256
Set-Cookie: lang=ja-JP

<!doctype html>
<html lang=ja> <!-- 日本語でレンダリング -->
  <head>
    <link rel=stylesheet href=desert.css>
    ...
```

次からは、 Accept-Language よりも Cookie の lang を優先してレンダリングすれば、ユーザは好きな言語にカスタマイズすることができるのだ。


```js
app.get('/', (req, res) => {
  const lang = req.cookie.lang || req.headers['accept-language'] // cookie を優先
  // html の生成時にオプションで lang を指定
  const html = render({lang})
  res.send(html)
})
```

他にも、サイトの見た目を変えるテーマ機能など、カスタマイズ/パーソナライズも Cookie のユースケースだ。

しかし、これらはまたブラウザを変えると設定が共有されないため、様々な端末を使い分けることが一般的な現代では、こうした設定もアカウントに紐づけて Session に保存することが多いのも事実だ。

さらに、 SPA のように JS で画面を構築することが増えると、こうした設定情報も JS から触れる方が良い、その場合は Cookie ではなく localStorage などに入れる方が便利だ。

いずれにせよ、最近では Cookie には session_id 相当のものを入れることが多くなり、利便性のために Session にある情報の一部をコピーして Cookie に付与するといった実装が多いだろう。


## Credential としての Cookie

「**ログイン認証は Session にアカウント情報を紐づけることだ**」と解説した。例えば Alice がパスワード認証でログインする場合、送られてきたアカウント名とパスワードを、保存済みの Alice のものと比較し、本当に Alice であることを確認し、 Session に Alice のアカウントを紐付ける。これは認証を終えると 「その session_id を持っているユーザは Alice である」とみなされることを意味する。

通常、ログインをしたユーザは、カートを操作できるだけでなく、買い物をしたり、注文履歴を見たり、メールアドレスや住所を確認したりできるだろう。

つまり、この session_id をなんとか盗み出し、それを自分のリクエストに付与して送ることができれば、だれでも Alice になりすましてサービスにアクセスすることが可能なのだ。

![TODO 図5](https://cacoo.com/diagrams/L0Jn5wPiobCrsSDy-F1F5A.png)

このことから、現状では Cookie は Credential (ユーザの資格情報)と呼ばれ、機密情報として扱われる。もし lang や theme などだけなら単体で漏洩しても成り済ますまではできないが(それでも個人情報漏洩の可能性はある)、前述の通り最近ではそうした設定値よりも Session ID としての利用が支配的であるため、 Cookie は Credential であり絶対に死守しないといけない情報なのだ。

従って、 Cookie を用いるサービスは、 Cookie の性質をきちんと把握し、適切な扱い/実装を行うことが求められる。

ここからは、 Credential としての Cookie をいかに適切に扱うか、に焦点を絞り、実装する上で知っておくべきことについて解説していく。

:::details Credential とは
Cookie は Credential と呼ばれるが、 Credentials は Cookie だけではない。 Fetch の仕様で [Credentials](https://fetch.spec.whatwg.org/#credentials) は、仕様には以下のように定義されている。

- HTTP cookies
- TLS client certificates
- authentication entries (for HTTP authentication)

いずれも、クライアントの認証に使われるものだ。 2 つめの TLS クライアント証明書は、あらかじめデバイスにインストールした証明書をサーバの要求によって提供するものなので、主に社内システムのアクセスなど限定した用途で使われる。 3 つめは要するに Basic 認証のことだ。便利だが UI がカスタマイズできないことやアカウントとパスワード以外のものを認証に含められないために一般的なサービスでは使われることが少ない。

したがって、現状 Credential と言えばほぼ Cookie のことを意味し、単なる設定値などのことではなく Session ID を指していると思ってよいだろう。

そして、もしこうした Credential を盗み出せる脆弱性がブラウザやサービスに見つかった場合は、それは一大事だ。場合によってはパスワードが漏れるよりも問題かもしれない、なぜならパスワードだけなら二段階認証などがあればログインを防げるかもしれないが、 Cookie はすぐログイン状態を復元し、本人しか見れないあらゆる個人情報を盗める可能性があるからだ。
:::