/* [Strict Maintenance Mode] 
Part Name: DataWashClean_V3.0_Final
Task: SS-DEEP-CLEAN & CLOUD-YAML-EXPORT
*/
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const MEET_DIR = path.join(__dirname, 'Meet');
const OUTPUT_FILE = 'Candidate_config.yaml';

function safeBase64Decode(str) {
    try {
        const normalized = str.replace(/-/g, '+').replace(/_/g, '/');
        return Buffer.from(normalized, 'base64').toString('utf8');
    } catch (e) { return str; }
}

// 爸爸，这里完全复刻了你给我的核心解析逻辑
function parseProtocolLink(link) {
    try {
        const line = link.trim();
        if (!line || !line.includes('://')) return null;

        // VMESS 解析
        if (line.startsWith('vmess://')) {
            const raw = line.replace('vmess://', '');
            const n = JSON.parse(safeBase64Decode(raw));
            return {
                fp: `VMESS-${n.add}-${n.port}`,
                data: { type: 'vmess', address: n.add, port: parseInt(n.port), id: n.id, aid: n.aid, net: n.net || "tcp", path: n.path || "", tls: n.tls || "" }
            };
        }

        // SS / VLESS / Trojan 通用解析
        const u = new URL(line);
        const protocol = u.protocol.replace(':', '').toLowerCase();
        let nodeData = { type: protocol, address: u.hostname, port: parseInt(u.port) };

        if (protocol === 'ss') {
            const decoded = safeBase64Decode(u.username);
            if (decoded.includes(':')) {
                const [m, p] = decoded.split(':');
                nodeData.method = m; nodeData.password = p;
            }
        } else {
            nodeData.uuid = u.username;
        }
        return { fp: `${protocol}-${nodeData.address}-${nodeData.port}`, data: nodeData };
    } catch (e) { return null; }
}

async function run() {
    if (!fs.existsSync(MEET_DIR)) fs.mkdirSync(MEET_DIR);
    const nodesMap = new Map();
    const files = fs.readdirSync(MEET_DIR).filter(f => f.endsWith('.txt'));

    for (const file of files) {
        const content = fs.readFileSync(path.join(MEET_DIR, file), 'utf8');
        let effective = content.includes('://') ? content : safeBase64Decode(content);
        const lines = effective.split(/\r?\n/).filter(l => l.includes('://'));
        
        lines.forEach(line => {
            const res = parseProtocolLink(line.trim());
            // 物理去重 + 广告过滤
            if (res && res.data.address && !res.data.address.includes('更新')) {
                nodesMap.set(res.fp, res.data);
            }
        });
    }

    // 重点：直接导出为 YAML 格式供后续步骤使用
    let yaml = "proxies:\n";
    Array.from(nodesMap.values()).forEach((n, i) => {
        const name = `Candidate-${i+1}`;
        if (n.type === 'vmess') {
            yaml += `  - {name: "${name}", type: vmess, server: ${n.address}, port: ${n.port}, uuid: ${n.id}, alterId: ${n.aid || 0}, cipher: auto, network: ${n.net || 'tcp'}, ws-opts: {path: ${n.path || '/'}}}\n`;
        } else if (n.type === 'ss') {
            yaml += `  - {name: "${name}", type: ss, server: ${n.address}, port: ${n.port}, cipher: ${n.method}, password: ${n.password}}\n`;
        }
    });
    fs.writeFileSync(OUTPUT_FILE, yaml);
}
run();
