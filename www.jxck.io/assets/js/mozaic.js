// add mozaic player
import MozaicPlayer from '/assets/js/mozaic-player.mjs'
import BackgroundFetch from '/assets/js/background-fetch.mjs'

// Enable debug log adding #debug into url
const log = location.hash === '#debug' ? console.log.bind(console) : () => {}
EventTarget.prototype.on  = EventTarget.prototype.addEventListener
EventTarget.prototype.off = EventTarget.prototype.removeEventListener
const $  = document.querySelector.bind(document)
const $$ = document.querySelectorAll.bind(document)

function reportingObserver() {
  log('ReportingObserver');
  const observer = new ReportingObserver((reports, observer) => {
    log(reports)
    const URL = 'https://reporting.jxck.io/beacon'
    for (const report of reports) {
      navigator.sendBeacon(URL, JSON.stringify(report))
    }
  }, {buffered: true})
  observer.observe()
}

// keybind
function playerKeybind(e) {
  log(e.key, e.target, document.activeElement)

  switch(e.key) {
    case 'Enter':
      // document body 以外の Enter は、コントロールが必要かもしれないので無視
      if (document.activeElement !== document.body) return
      log('play/pause')
      $('mozaic-player').play()
      e.preventDefault()
      break
    case 'ArrowLeft':
      log('back')
      $('mozaic-player').back()
      break
    case 'ArrowRight':
      log('forward')
      $('mozaic-player').forward()
      break
    case '/':
      log('shortcut')
      const $shortCutDiag = $('dialog.shortcut')
      if ($shortCutDiag.open) {
        $shortCutDiag.close()
        break
      }
      $shortCutDiag.showModal()
      $shortCutDiag.on('click', (e) => {
        log(e.target, $shortCutDiag)
        if (e.target === $shortCutDiag) {
          $shortCutDiag.close()
        }
      })
      break
  }
}

function enablePortal($portal) {
  if ($portal === null) return
  $portal.style.display = 'block'
  const $links = document.querySelectorAll('article li a')
  $links.forEach(($a) => {
    let timer;
    $a.on('mouseover', (e) => {
      log(e)
      timer = setTimeout(() => {
        $portal.src = e.target.href
      }, 1000)
    })

    $a.on('mouseout', (e) => {
      log(e)
      clearTimeout(timer)
    })
  })
  $portal.on('click', (e) => {
    log(e)
    if ($portal.src === '') return
    $portal.classList.add('activate')
    $portal.on('transitionend', (e) => {
      log(e)
      $portal.activate()
    })
  })
}

function enablePlayer() {
  log(MozaicPlayer)
  customElements.define('mozaic-player', MozaicPlayer);
  // document.on('keydown', playerKeybind)
}

function enableWebShare() {
  const $share = $('#share')
  if ($share !== null) {
    $share.classList.remove('disabled')
    $share.addEventListener('click', (e) => {
      log(e)
      const url   = location.href
      const title = document.title
      const text  = document.querySelector('meta[property="og:description"]').content
      navigator.share({url, title, text})
    })
  }
}

function enableShortCutDiag() {
  // <dialog> があったら shortcut を <dialog> で出す
  const shortCutDiag = document.importNode($('#shortcut_diag').content, true)
  document.body.appendChild(shortCutDiag)
}



// main
if (window.ReportingObserver) {
  reportingObserver()
}

document.on('DOMContentLoaded', async (e) => {
  // Enable Mozaic Player
  if (window.customElements) {
    enablePlayer()
  } else {
    // custom element 無い場合は controls
    const $audio = $('audio')
    if ($audio !== null) {
      $audio.controls = true
    }
  }

  // Enable Web Share
  if (navigator.share) {
    enableWebShare()
  }

  // Enable ShortCut Dialog
  if (window.HTMLDialogElement) {
    enableShortCutDiag()
  }

  if (window.HTMLPortalElement) {
    enablePortal($('portal#preview'))
  }

  // for Debug
  if (location.hash === '#clear') {
    const registrations = await navigator.serviceWorker.getRegistrations()
    registrations.forEach(async (registration) => {
      log(registration)
      await registration.unregister()
    })
    return
  }

  // const controllerChange = new Promise((resolve, reject) => {
  //   if (navigator.serviceWorker.controller) {
  //     resolve(navigator.serviceWorker.controller);
  //   } else {
  //     navigator.serviceWorker.addEventListener('controllerchange', (e) => {
  //       log(e.type)
  //       resolve(navigator.serviceWorker.controller)
  //     })
  //   }
  // })

  const registration = await navigator.serviceWorker.register('/assets/js/sw.js', { scope: '/' })
  await Promise.all([
    navigator.serviceWorker.ready,
    //controllerChange
  ])

  if (registration.backgroundFetch) {
    console.log('registration.backgroundFetch')
    customElements.define('background-fetch', BackgroundFetch)

    $$('background-fetch').forEach(async ($bgfetch) => {
      $bgfetch.classList.remove('disable')
      const id    = $bgfetch.previousElementSibling.href
      const url   = $bgfetch.getAttribute('url')
      const size  = parseInt($bgfetch.getAttribute('max'))
      const mtime = parseInt($bgfetch.getAttribute('mtime'))
      const cache = await caches.match(url)

      // check etag
      const current_etag = `"${mtime.toString(16)}-${size.toString(16)}"`
      const saved_etag   = cache?.headers.get('etag')
      log(current_etag, saved_etag, current_etag === saved_etag)

      if (current_etag === saved_etag) {
        // cache がある
        $bgfetch.setAttribute('value', size)
        $bgfetch.shadowRoot.querySelector('#arrow').part.add('done')
      } else {
        // cache がない
        $bgfetch.on('click', async (e) => {

          // html も一緒に取得したいが、 downloadTotal を出すのが面倒なので
          // cache の追加を sw に依頼
          const controller = navigator.serviceWorker.controller
          controller.postMessage({type: 'save', url: id})

          console.log(e)
          const option = {
            title: $('title').textContent,
            icons: [
              {src: '/assets/img/mozaic.jpeg', type: 'image/jpeg', sizes: '2000x2000'},
              {src: '/assets/img/mozaic.webp', type: 'image/webp', sizes: '256x256'},
              {src: '/assets/img/mozaic.png',  type: 'image/png',  sizes: '256x256'},
              {src: '/assets/img/mozaic.svg',  type: 'image/svg+xml'}
            ],
            downloadTotal: size
          }

          // register background task
          let task = await registration.backgroundFetch.get(id)
          if (task === undefined) {
            task = await registration.backgroundFetch.fetch(id, [url], option)
          }
          task.addEventListener('progress', (e) => {
            console.log(task, task.downloaded)
            $bgfetch.setAttribute('value', task.downloaded)
          })
        })
      }
    })
  }

  if (registration.periodicSync) {
    const status = await navigator.permissions.query({name:'periodic-background-sync'});
    log(status)
    if (status.state === 'granted') {
      const tags = await registration.periodicSync.getTags()
      log('remove periodicSync tags', tags)
      await Promise.all(tags.map((tag) => registration.periodicSync.unregister(tag)))
      await registration.periodicSync.register('test-3h', {
        minInterval: 3 * 60 * 60 * 1000 // 3h
      })
    }
  }

  window.addEventListener('beforeinstallprompt', (install_prompt) => {
    console.log(e)
    e.preventDefault()
    const $install = $('#install')
    $install.classList.remove('disabled')
    $install.on('click', async () => {
      install_prompt.prompt()
      const choice = await install_prompt.userChoice
      console.log(choice)
    })
  })
})
