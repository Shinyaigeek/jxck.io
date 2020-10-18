---
title: "3rd Party Cookie とは何か"
emoji: "📝"
type: "tech"
topics: ["cookie", "web"]
published: false
---

## 3rd Party Cookie

例として  https://example.com には、 `<iframe>` で https://ad.example が埋め込まれているとする。

本体が 1st Party 、埋め込まれているサイトが 3rd Party である。

- 1st: https://example.com
- 3rd: https://ad.example


```html
<h1>1st Party</h1>
<p>this is 1st party content</p>
<iframe src=https://ad.example></frame>
```

このとき 3rd Party のレスポンスが以下のようになっていたとする。


```http
HTTP/1.1 200 OK
Content-Length: 100
Content-Type: text/html
Set-Cookie: id=deadbeef

<!doctype html>
```

ここで返ってきた Cookie は、 https://ad.example に紐づけてブラウザに保存される。

すると、同じように https://ad.example を iframe で埋め込んだサイトにアクセスしたら、保存された Cookie を送信することになる。このような Cookie を 3rd Party Cookie と呼ぶ。

つまり、同じ iframe を埋め込んでいれば 1st Party がなんであれ同じ Cookie が送信されるため、別のページでもアクセスしている人を識別することができるのだ。

3rd Party Cookie は iframe でなくとも、 JS, CSS, Img などのサブリソースでも送られるが、埋め込んだ後の JS による操作といった自由度を考えて iframe で行われる場合が多い。

そして、埋め込む内容の代表例が広告だ。

例えばある EC サイトで「タオル」について検索をしたとする。タオルの検索結果ページは iframe の URL にパラメータでタオルを調べたことを埋め込んでおく。


```html
<h1>「タオル」の検索結果</h1>
<p>おすすめタオル一覧</p>
<iframe src=https://ad.example/keyword?q=towel></frame>
```

この iframe によって、すでに `Set-Cookie: deadbeef` を受け取っていれば、この `iframe` へのリクエストは以下のようになるだろう。


```http
GET /keyword?q=towel
Host: ad.example
Cookie: id=deadbeef
```

これにより、広告配信元は `deadbeef` を保存したブラウザは、 `towel` をキーワードとして検索したことがあることを知ることができる。

すると、ユーザが全然別のページに遷移した後も、そのページが同じ広告を埋め込んでいれば、 Cookie から過去の検索情報を知り、「タオル」に関する広告を出すことができる。

もっと言えば、バックエンドで 3rd Party の広告会社が持っている検索結果の情報を、 1st に提供すれば、別の EC に遷移した後、何も検索してないのにおすすめに「タオル」を出すといったことができるのだ。

このように 3rd Party の Cookie を利用して、サイトをまたいでユーザを識別し、ときにその行動履歴を紐づけて、広告などに活かす方法が、 3rd Party Cookie による Tracking と呼ばれるものだ。

我々が日常、どこかで検索した結果が、全く別のサイトでおすすめとして埋め込まれていたりするのは、この仕組みをベースとしている。


## Single Sign On

複数のサービスに 1 つのアカウントでログインできる仕組みを Single Sign On という。

例えば、 Google の場合は Google にログインしていれば Youtube も Gmail もログイン画面を経ずにログイン状態でアクセスすることができる。

認証自体は、なんらかの方法で認証情報(ID + Password 等)を共有できればよいが、 Web の場合はログインした状態を共有するのにも 3rd Party Cookie が使われる。

*ここから、その概要的な処理の流れを示しつつ、 3rd Party Cookie の使われ方を解説するが、あくまで例示のための挙動であり、これをこのまま Single Sign On として実装するのは危険である。あくまで 3rd Party Cookie の使われたを理解するための助けとして読んで欲しい*

例えば、社内ポータルの https://portals.example にログインしている社員は、 https://kintai.example.com にも認証無しでログインさせたいとする。

社内ポータルアクセス時に認証を経て、 Cookie を付与したとしても、その Cookie はあくまで https://portals.example に紐付いているため、 https://kintai.example.com には送信されない。

この問題を解決する方法はいくつかあるが、典型的な手法はもう一つ認証用のドメインを用意することだ。

例えば https://portals.example にアクセスし、 Cookie が無かった場合は認証が必要と判断され、共通認証用のドメインである https://account.example.jp にリダイレクトされる。このとき、認証が終わった後に portals に戻ってこれるように、クエリパラメータを以下のようにしておく。


```http
302 Found HTTP/1.1
Location: https://account.example.jp&from=https://portals.example
```

社内の認証は https://account.example.jp というドメインで行うことにし、どの社内システムにアクセスしても Cookie が無ければ同様に最初はこのドメインにリダイレクトされる。

このページの認証画面に、 ID とパスワードを入力するとログインが行われ、 Cookie が発行される。

この Cookie は https://account.example.jp に紐付いている点が重要だ。

そして、そのレスポンスで元の https://account.example.jp にリダイレクトで戻す。

その URL には、認証済みである情報を付与しておく。この情報はセッション ID などと呼ばれることが多い。


```http
303 See Other HTTP/1.1
Set-Cookie: session_id=deadbeef
Location: https://portals.example/?session_id=deadbeef
```

すると、 https://portals.example はクエリパラメータに付与された情報から、共通認証による認証が済んでいることを判断し、ログインさせる。このセッション ID を 1st Party Cookie として付与すれば、次にアクセスしたときは Cookie があるためログイン済みとなる。


```http
200 OK HTTP/1.1
Set-Cookie: session_id=deadbeef
```

さて、ここまででユーザは account と portals に Cookie を持っている状態になった。

ここで、 https://kintai.example.com というまた別のアカウントにアクセスしたらどうなるだろうか。

まだ Cookie を持っていないため、ユーザは最初に portal にアクセスしたときと同じように https://account.example.jp にリダイレクトされる。

ところが、今回は account.example.jp への Cookie はすでにあるため、それが送られることになる。


```http
302 Found HTTP/1.1
Location: https://account.example.jp&from=https://portals.example
Cookie: session_id=deadbeef
```

すると、 account.example.jp には認証済みとわかるため、ログイン画面は出ずにそのまま kintai へリダイレクトされる。

このとき、すでに Cookie は付与しているため Set-Cookie は不要だ(更新のために付与しても良い)

そして、 kintai に対して認証済みであることを知らせるために URL のクエリには session_id つける。


```http
303 See Other HTTP/1.1
Location: https://kintai.example.com/?session_id=deadbeef
```

すると、 kintai はクエリに有る session_id から認証済みであることを知り、ログインさせる。

ユーザとしては、 kintai にアクセスしたら二回リダイレクトが発生しただけでログイン済みとなった形になる。

もちろん kintai は自分のための 1st Party Cookie を付与することで次回からのアクセスもログイン済みにできる。

つまり Single Sign On は、共通する認証ドメインを用意し、その Cookie を保存させ、リダイレクトで認証ドメインを経由することで、 SSO に参加する任意のドメインを認証するのが基本的な考え方だ。

認証ドメイン(account.example.jp) の Cookie は全てのサービスからみて 3rd Party Cookie であるため、これも 3rd Party Cookie を利用していると言える。

(何度も言うが、上記の仕組みはあくまでも理解を助けるための概要であり、そのまま実装すると多種の問題が起こるだろう、基本的に SSO は自分で実装しようとせず適切なソリューションの導入を検討することを強く勧める)


## 3rd Party Cookie


## ITP
