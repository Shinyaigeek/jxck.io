---
title: "Session Storage の構成"
emoji: "📝"
type: "tech"
topics: ["architecture", "cookie", "web"]
published: false
---

# Session Storage の構成

ここまで Cookie の性質や用途について解説してきた。 Cookie 自体はブラウザ内に保存する値では有るが、 Session Cookie の場合は、その値に紐付いた Session Object をサーバ側に確保する必要がある。

本節では、代表的な Session Object の保存方法や、それを踏まえた上での代表的なサーバ構成について解説する。


## メモリ上への確保

最も基本的な保存先として、 Session Object を使用するアプリケーションが動いている、アプリケーションサーバ(App サーバ)上のメモリがある。

![app サーバのメモリ上に確保](https://cacoo.com/diagrams/L0Jn5wPiobCrsSDy-C6DDF.png)

ローカルメモリ上にあるため、 Session ID をキーとした単なる Map オブジェクトとして保持すると言った実装も可能であるが、多くのアプリケーションサーバがデフォルトで対応しており、そうした実装に任せることの方が多いだろう。通常そうした実装は Session ID 自体の生成などについてもサポートしているため、 Cookie の値含めあまり意識せず使えることが多い。

ローカルメモリにそのまま確保しているため、アクセス速度も早く問題になることはほぼ無いが、メモリサイズがネックになりやすく、枯渇した場合は増設以外に方法がない。また、ファイルなどへの永続がサポートされていない場合は、サーバが落ちたり再起動するだけで Session Object が消し飛ぶことになる。

また、 App サーバが一台であればよいが、複数台用意しリクエストを分散させると、ローカルメモリの内容をサーバ間で共有する方法を考える必要が出てくる。

:::message
各サーバのローカルメモリ上にある Session Object を、別のサーバに共有するような実装も無くはない。ただし、現在では後述するように別途 Session Storage を立てる方が一般的だろう
:::


## memcache/redis サーバの分離

App サーバとは別に、 Session Object を保存するための DataBase (DB) を用意し、そちらに保存する構成だ。こうした DB は Session Object を保存するため Session Storage と呼ばれることが多いだろう。

![memcache や redis などに保存し app サーバから参照](https://cacoo.com/diagrams/L0Jn5wPiobCrsSDy-7F6D7.png)

Session Object はアクセス頻度が高く、 Session ID をキーとした KVS での実装と相性が良いため、 On Memory で高速にアクセスできる Memcache や Redis といった実装が使われることが多い。

一般的な構成の一つであるため、アプリケーションサーバの実装も、ミドルウェアとして Session Object の保存先に Memcache や Redis などを指定するためのプラグインも多いだろう。


## 共有サーバとスケーラビリティ

Session Storage が App サーバと分離したことで、 App サーバを複数台に分散した場合も、共通して Session Storage を参照すれば、どの App サーバがリクエストを受けても Session Object が取得できるようになる。これにより App サーバの前に LoadBalancer を立て、ラウンドロビン(リクエストを順番に割り振る)構成が取れるようになりスケーラビリティが確保できるのだ。

![app サーバを複数立て LB で分散し、共通の db サーバを参照](https://cacoo.com/diagrams/L0Jn5wPiobCrsSDy-FD2CC.png)

また 、 Memcache や Redis 自体を複数台に分散する技術もあるため、 App サーバから見れば単一に見える Session Storage が、実際には複数台のサーバに分散されているという構成も取れるため、 Session Storage 自体のスケーラビリティも確保できる。冗長構成などを考えて構成すれば、 Session Storage 全体が一度に落ちない限りは Session Object は消えないというような状態も維持しやすいため、 Session Storage の最も基本となる構成と言って良いだろう。


## sticky session と LB

いくらアクセスの速い KVS を共有しているといっても、 App サーバのローカルにあるならその方がアクセスが速い。しかし LB でラウンドロビンをしてしまうと、最悪毎回別の App サーバに振り分けられ、毎回 Session Storage にアクセスする必要が出てしまうだろう。

そこで、 LB によっては Sticky Session をサポートしている場合がある。 Sticky Session は、あるクライアントを振り分けた先のサーバを覚えておき、同じクライアントからのリクエストを同じサーバに振り分ける機能だ。

その振り分けテーブルのキーとして、クライアントを識別する何かしらのキーが必要となるため LB は独自の ID を発行し、 Set-Cookie によってクライアントに付与する。しかし、既にアプリが使っている Session ID はクライアントの識別にそのまま使えるため、 LB によっては Cookie のキーを指定すればそれを使ってくれるだろう。

![LB サーバに Sticky Session を認識させ、固定の app サーバに振り分け](https://cacoo.com/diagrams/L0Jn5wPiobCrsSDy-ED651.png)

この構成を取るためには、 LB は Cookie の値を見る必要があるが、暗号化された通信では LB がリクエストの中身を見ることができない。そのため LB よりも手前のどこかで暗号化を解く必要がある。別途手前に暗号化を解くサーバ(TLS 終端サーバ)が置かれる場合もあるが、この LB が TLS 終端サーバを兼ねる構成も一般的だろう。


## DB への保存

Session Object は常に On Memory な KVS に保存されるかと言うと、必ずしもそうではない。

例えば前節で解説したように、カートを Session Object に保存するような実装をしていた場合、 Session Object が消えることは、カートの中身が消し飛ぶことを意味する。もちろん Session Storage に冗長構成を取ることで、そのリスクを減らすことはできるが、基本はサーバが絶対に落ちない構成を求めるよりも、落ちても絶対に大丈夫な構成を取るほうが現実的だ。

そこで、 Session Object の内容を永続化が可能な RDB などに保存するという方法も考えられる。極端に言えば RDB の 1 行に ID を Primary Key として保存するという構成だ。 Session Object はスキーマが固定しづらいので、 Value を JSON などのシリアライザで文字列にしたり、より柔軟な Scheme Less な DB を選択することもあるだろう。

ただ、そもそも消えて困るような情報を Session Object に入れるべきではないという方針の方を先に検討するべきでもある。ここまで、 Session の例としてある意味お約束な「ショッピングカート」を採用して解説をしてきたが、もはや現代の EC サイトの構成において、ショッピングカートがそのまま Session Storage にのみ入っているということは、おそらく無いだろう。

もちろんキャッシュとして Session Object にコピーしている場合はあるが、消えて困るものは基本的に永続化可能な DB に入れるようにし、 Session Object にはその Session の中でのみ必要な情報だけを保持し、消えたとしても文字通り Session が失われるだけで、再度アクセスしたら session_id を振り直し、認証をすれば回復するような状態にとどめておくのが理想だ。

何を Session Object に置くのかは、アプリケーションの設計にかなり依存するので一般化は難しいが、消し飛んだときのことを考えて設計していくと良いだろう。


## クライアントにシリアライズして保存する場合


## JWT を導入する場合


## JWE / JWS の併用


## SPA の場合のトークン保持
