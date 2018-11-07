import { app, BrowserWindow, Menu} from 'electron'
import node from '../app/node'
/**
 * Set `__statics` path to static files in production;
 * The reason we are setting it here is that the path needs to be evaluated at runtime
 */
if (process.env.PROD) {
  global.__statics = require('path').join(__dirname, 'statics').replace(/\\/g, '\\\\')
}

const createMenu = () => {
  const mainMenuTemplate = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Add Item',
          click() {
            addWindow = new BrowserWindow({
              width: 300,
              height: 300,
              title: 'Add List Item'
            })
            addWindow.loadURL(url.format({
              pathname: path.join(__dirname, 'add-window.html'),
              protocol: 'file:',
              slashes: true
            }))
            //Garbage collection (clear memory on window close)
            addWindow.on('close', _ => addWindow = null)
          }
        },
        {label: 'Clear Items'},
        {
        label: 'Quit',
        //key bindings
        accelerator: process.platform == 'win32' ? 'Ctrl+Q' : 'Command+Q',
        //click event to quit app
         click() {
           app.quit()
         }
       }
      ]
    }
  ]

  //if mac add empty object to menu to get rid of 'electron' menu item
  if (process.platform == 'darwin') {
    mainMenuTemplate.unshift({})
  }

  //add dev tools if not in production
  if (process.env.NODE_ENV != 'production') {
    mainMenuTemplate.push({
      label: 'Dev Tools',
      submenu: [
        {
          label: 'Toggle',
          accelerator: process.platform == 'win32' ? 'Ctrl+I' : 'Command+I',
          click(item, focusedWindow) {
            focusedWindow.toggleDevTools()
          }
        },
        {
          role: 'reload'
        }
      ]
    })
  }
  //Build menu from mainMenuTemplate
  const mainMenu = Menu.buildFromTemplate(mainMenuTemplate)
  //Set applicaton menu
  Menu.setApplicationMenu(mainMenu)
}

let mainWindow

function createWindow () {
  /**
   * Initial window options
   */
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 900,
    useContentSize: true
  })

  mainWindow.loadURL(process.env.APP_URL)

  mainWindow.on('closed', () => {
    mainWindow = null
    node.stop()
    app.quit()
  })
}

const initApp = async _ => {
  await node.setup()
  await node.start()
  createWindow()
  createMenu()

}

app.on('ready', initApp)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', async () => {
  try {
    if (mainWindow === null) {
      createWindow()
    }
  } catch (err) {
    console.log(err)
  }
})
