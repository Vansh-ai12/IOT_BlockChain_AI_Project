// services/ipfs.js (FINAL FIX - Stable Helia for Node backend)

let heliaNode = null;
let fs = null;

const initHelia = async () => {
    if (!heliaNode) {
        const { createHelia } = await import('helia');
        const { unixfs } = await import('@helia/unixfs');
        const { MemoryBlockstore } = await import('blockstore-core/memory');
        const { MemoryDatastore } = await import('datastore-core/memory');

        // 🔥 CRITICAL FIX: Disable libp2p networking stack
        heliaNode = await createHelia({
            blockstore: new MemoryBlockstore(),
            datastore: new MemoryDatastore()
            // No libp2p config = no relay/identify dependency crash
        });

        fs = unixfs(heliaNode);

        console.log("✅ Helia IPFS node started (OFFLINE MODE - Stable)");
    }
    return fs;
};

const uploadFileToIPFS = async (buffer) => {
    try {
        const ipfsFs = await initHelia();
        const cid = await ipfsFs.addBytes(buffer);
        return cid.toString();
    } catch (err) {
        console.error("Helia Upload Error:", err);
        throw err;
    }
};

const getFileFromIPFS = async (cid) => {
    const ipfsFs = await initHelia();
    const chunks = [];

    for await (const chunk of ipfsFs.cat(cid)) {
        chunks.push(chunk);
    }

    return Buffer.concat(chunks);
};

module.exports = {
    uploadFileToIPFS,
    getFileFromIPFS
};