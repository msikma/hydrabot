// HydraBot <https://github.com/msikma/hydrabot>
// © MIT license

import os from 'os'
import fs from 'fs/promises'
import path from 'path'
import url from 'url'
import {ArgumentParser} from 'argparse'

const main = async () => {
  const pkgPath = path.join(url.fileURLToPath(new URL('.', import.meta.url)), '..', '..', 'package.json')
  const pkgData = JSON.parse(await fs.readFile(pkgPath, 'utf8'))
  const parser = new ArgumentParser({
    add_help: true,
    description: `${pkgData.description}.`,
    epilog: 'Send questions and comments to @dada78641 on Twitter.'
  })

  parser.add_argument('-v', '--version', {action: 'version', version: `${pkgData.version}`})
  parser.add_argument('-t', '--test', {help: 'runs initialization and exits', dest: 'actionTest', action: 'store_true'})
  parser.add_argument('--cfg-path', {help: 'path to the config directory', metavar: 'PATH', dest: 'pathConfig', default: `${os.homedir()}/.config/hydrabot/`})
  parser.add_argument('--cfg-cache', {help: 'path to the cache directory', metavar: 'PATH', dest: 'pathCache', default: `${os.homedir()}/.cache/hydrabot/`})
  
  // Parse command line arguments; if something is wrong, the program exits here.
  const args = {
    ...parser.parse_args(),
    pathPackage: path.resolve(path.dirname(pkgPath)),
    packageData: pkgData
  }
  
  // Start the bot.
  // If something goes wrong during initialization, the process will terminate.
  // Otherwise, the bot will continue running until exited using CTRL+C.
  const hbInit = await import('hydrabot-core/init.js')
  hbInit.initFromCli(args)
}

main()
