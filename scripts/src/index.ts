import * as cfg from './config';
import {
  chainDetailsPage,
  formatHTMLTable,
  generateAllChainIdsTable,
  generateAllConsistencyLevelsTable,
  generateAllContractsTable,
} from './details';
import { chainCard } from './card';
import * as fs from 'fs';

// Matches for tag search
type Match = {
  fname: string;
  start: number;
  stop: number;
};

// Reads each of the files in the provided `contentDir` and looks for any
// <!--tag--> comments. It then looks for matching tags and saves the start
// and stop index of the matching tags. The content between the tags is
// what is auto-generated
async function findTag(contentDir: string, tag: string): Promise<Match[]> {
  const fullTag = `<!--${tag}-->`;

  const files = fs.readdirSync(contentDir);

  const matches: Match[] = [];
  for (const file of files) {
    const path = `${contentDir}/${file}`;
    const stat = fs.statSync(path);
    if (stat.isDirectory()) {
      matches.push(...(await findTag(path, tag)));
    } else {
      const buff = fs.readFileSync(path);
      const startIdx = buff.indexOf(fullTag, 0);

      // no match
      if (startIdx <= 0) continue;

      const stopIdx = buff.indexOf(fullTag, startIdx + 1);
      matches.push({
        fname: path,
        start: startIdx + fullTag.length,
        stop: stopIdx,
      });
    }
  }

  return matches;
}

// Iterates over the docs directory to find the tags where the newly
// generated content will need to be placed. Once found, the new content
// provided will overwrite the outdated content
async function overwriteGenerated(tag: string, content: string) {
  // path to doc source, relative to where we run the `npm run generate` cmd
  const contentDir = '../wormhole-docs/.snippets/text';

  const matches = await findTag(contentDir, tag);

  if (matches.length === 0) {
    console.error(`no tags for ${tag}`);
    return;
  }

  // Track the size delta to adjust for changes as we go
  for (const match of matches) {
    const oldFile = fs.readFileSync(match.fname);
    const head = oldFile.subarray(0, match.start);
    const tail = oldFile.subarray(match.stop);
    const newFile = Buffer.concat([head, Buffer.from(`\n${content}\n`), tail]);
    fs.writeFileSync(match.fname, newFile);
  }
}

(async function () {
  // Get each of the supported chains
  const chains = cfg.getDocChains();

  const supportedChains: string[] = [];
  const chainPages: Record<string, string> = {};

  for (const chain of chains) {
    if (chain.mainnet.extraDetails !== undefined) {
      // Supported chains for intro page
      // Add chain card to the current row
      supportedChains.push(chainCard(chain.mainnet, chain.chainType));

      // Chain-specific pages
      chainPages[chain.mainnet.name] = chainDetailsPage(chain);
    }
  }

  const supportedChainsMarkdown = `
<div class="card-container" markdown>
${supportedChains.join('\n')}
</div>
  `;

  // TODO: concurrent? will that wreck anything?
  // find tags _first_ in one pass and come back to fill them in?
  // currently this searches docs every time we call it
  await overwriteGenerated(
    'SUPPORTED_BLOCKCHAIN_CARDS',
    supportedChainsMarkdown
  );


  // TODO: Auto-generate each of the environment pages under Supported Networks
  // for (const [chainName, chainPage] of Object.entries(chainPages)) {
  //   await overwriteGenerated(
  //     `${chainName.toUpperCase()}_CHAIN_DETAILS`,
  //     chainPage
  //   );
  // }

  // Contract addresses
  await overwriteGenerated(
    'CORE_ADDRESS',
    generateAllContractsTable(chains, 'core')
  );
  await overwriteGenerated(
    'TOKEN_BRIDGE_ADDRESS',
    generateAllContractsTable(chains, 'token_bridge')
  );
  await overwriteGenerated(
    'NFT_BRIDGE_ADDRESS',
    generateAllContractsTable(chains, 'nft_bridge')
  );
  await overwriteGenerated(
    'RELAYER_BRIDGE_ADDRESS',
    generateAllContractsTable(chains, 'wormholeRelayerAddress')
  );
  await overwriteGenerated(
    'CCTP_ADDRESS',
    generateAllContractsTable(chains, 'cctp')
  );
  // await overwriteGenerated(
  //   "GATEWAY_ADDRESS",
  //   generateAllContractsTable(chains, "cctp")
  // );

  await overwriteGenerated(
    'CONSISTENCY_LEVELS',
    generateAllConsistencyLevelsTable(chains)
  );

  await overwriteGenerated('CHAIN_IDS', generateAllChainIdsTable(chains));
})();
