const { app } = require('electron')
const { is } = require('electron-util')
const execa = require('execa')
const {
  createWriteStream,
  ensureDir,
  pathExists,
  readdir,
  readJson,
  remove,
  writeFile,
} = require('fs-extra')
const path = require('path')
const os = require('os')

const platform = {
  darwin: 'mac',
  linux: 'linux',
  win32: 'win',
}[os.platform()]

const getBinPath = is.development
  ? name => path.join(__dirname, '..', '..', 'bin', `${name}-${platform}`)
  : name => path.join(process.resourcesPath, 'bin', name)

const dataDir = path.join(app.getPath('userData'), 'data')
const pwdPath = path.join(dataDir, 'pwd')
const keystorePath = path.join(dataDir, 'keystore')
const logPath = path.join(dataDir, 'node.log')
const gethPath = getBinPath('geth')
const swarmPath = getBinPath('swarm')

let swarmprocess
let gethprocess

const setup = async () => {
  console.log("===launching geth setup===")
  console.log(getBinPath('geth'))
  if (await pathExists(keystorePath)) {
    console.log('keystore exists, skip setup')
    return
  }

  await ensureDir(dataDir)
  await writeFile(pwdPath, 'secret')
  await execa(gethPath, [
    '--datadir',
    dataDir,
    '--password',
    pwdPath,
    'account',
    'new',
  ])
}

const start = async () => {
  await startGeth()
  await startSwarm()
}

const startGeth = async () => {
  console.log('Starting geth')
  const keystoreFiles = await readdir(keystorePath)
  const keyFilePath = path.join(keystorePath, keystoreFiles[0])
  const keystore = await readJson(keyFilePath)

  return new Promise((resolve, reject) => {
    gethprocess = execa(gethPath, [
      //'--bootnodes',
      //'',
      //'--networkid',
      //'',
      '--rpc',
      '--rpcapi',
      'eth,web3,net,db,debug',
      '--rpccorsdomain',
      '127.0.0.1',
      '--syncmode',
      'light',
      '--etherbase',
      keystore.address
    ])

    gethprocess.catch(error => {
      console.error('Failed to start Geth node: ', error.stderr)
      reject(error.stderr)
    })

    gethprocess.stderr.pipe(createWriteStream(logPath))

    gethprocess.stdout.on('data', data => {
      const dataStr = data.toString()
      console.log(dataStr)
      if (dataStr.toLowerCase().indexOf('fatal:') !== -1) {
        const error = new Error(`Geth error: ${dataStr}`)
        console.log(error)
        reject(error)
      }
    })

    gethprocess.stderr.on('data', data => {
      if (
        data
          .toString()
          .toLowerCase()
          .indexOf('http endpoint opened') !== -1
      ) {
        console.log('Geth node started')
        resolve()
      }
    })

  })

}
const startSwarm = async () => {
  console.log('Starting swarm')
  const keystoreFiles = await readdir(keystorePath)
  const keyFilePath = path.join(keystorePath, keystoreFiles[0])
  const keystore = await readJson(keyFilePath)

  return new Promise((resolve, reject) => {
    swarmprocess = execa(swarmPath, [
      '--datadir',
      dataDir,
      '--password',
      pwdPath,
      '--bzzaccount',
      keystore.address,
      '--bzzport',
      '8500',
      '--ws',
      '--wsorigins',
      '*',
      '--wsport',
      '8600',
      '--ens-api',
      '',
      '-store.size',
      '1000000'
    ])

    swarmprocess.catch(error => {
      console.error('Failed to start Swarm node: ', error.stderr)
      reject(error.stderr)
    })

    swarmprocess.stderr.pipe(createWriteStream(logPath))

    swarmprocess.stdout.on('data', data => {
      const dataStr = data.toString()
      if (dataStr.toLowerCase().indexOf('fatal:') !== -1) {
        const error = new Error(`Swarm error: ${dataStr}`)
        console.log(error)
        reject(error)
      }
    })

    swarmprocess.stderr.on('data', data => {
      if (
        data
          .toString()
          .toLowerCase()
          .indexOf('websocket endpoint opened') !== -1
      ) {
        console.log('Swarm node started')
        resolve()
      }
    })
  })
}

const stopGeth = _ => {
  return gethprocess ? new Promise(resolve => {
    gethprocess.once('exit', resolve)
    gethprocess.kill()
    gethprocess=undefined
  }) : Promise.resolve()
}

const stopSwarm = _ => {
  return swarmprocess
    ? new Promise(resolve => {
        swarmprocess.once('exit', resolve)
        swarmprocess.kill()
        swarmprocess = undefined
      })
    : Promise.resolve()
}

const stop = async () => await Promise.all([stopGeth(), stopSwarm()])

const reset = async () => {
  await stop()
  await remove(dataDir)
  await setup()
}

export default { reset, setup, start, stop }
