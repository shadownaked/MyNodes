/* [Strict Maintenance Mode] 
Part Name: DataWashClean_V3.3_Cloud_Full_Restoration
Task: SS-DEEP-CLEAN & FULL-LOGIC-RESTORATION & YAML-EXPORT
Enforcement: 《七魂·镇邪卷》- 物理切除所有省略与模糊
Version: 2026.02.11
*/

const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const MEET_DIR = path.join(__dirname, 'Meet');
const OUTPUT_FILE = 'Candidate.json';
const YAML_OUTPUT_FILE = 'Candidate_config.yaml';

/**
 * 像素级 Base64 安全解码
 */
function safeBase64Decode(str) {
    try {
        const normalized = str.replace(/-/g, '+').replace(/_/g, '/');
        return Buffer.from(normalized, 'base64').toString('utf8');
    } catch (e) {
        return str;
    }
}

/**
 * 核心协议解析引擎：Nexus-V2.2 镇邪级
 * 目标：将混杂了路径、参数、Base64的“生肉”解析为纯净的 Xray 字段
 */
function parseProtocolLink(link) {
    try {
        const line = link.trim();
        if (!line || !line.includes('://')) return null;

        // --- 1. VMESS 解析逻辑 (Base64 JSON) ---
        if (line.startsWith('vmess://')) {
            const raw = line.replace('vmess://', '');
            const n = JSON.parse(safeBase64Decode(raw));
            // 每一个字段都必须类型对齐，数字就是数字，字符串就是字符串
            return {
                fp: `VMESS-${n.add}-${n.port}-${n.path || ''}`,
                data: {
                    type: 'VMESS',
                    address: n.add,
                    port: parseInt(n.port),
                    id: n.id,
                    aid: parseInt(n.aid) || 0,
                    net: n.net || "tcp",
                    path: n.path || "",
                    host: n.host || "",
                    tls: n.tls || "",
                    sni: n.sni || n.host || ""
                }
            };
        }

        // --- 2. 通用解析逻辑 (SS / VLESS / Trojan) ---
        const u = new URL(line);
        const protocol = u.protocol.replace(':', '').toUpperCase();
        
        // 抓取所有 Query 参数作为备用零件
        const params = {};
        u.searchParams.forEach((v, k) => { params[k] = v; });

        let nodeData = {
            type: protocol,
            address: u.hostname,
            port: parseInt(u.port),
            net: params.type || params.net || "tcp",
            path: params.path || u.pathname || "",
            security: params.security || (u.port === "443" ? "tls" : "none"),
            sni: params.sni || params.host || u.hostname,
            pbk: params.pbk || "",
            sid: params.sid || "",
            flow: params.flow || ""
        };

        // --- 3. SS 协议深度去泥手术 ---
        if (protocol === 'SS') {
            if (u.username) {
                const decodedUserInfo = safeBase64Decode(u.username);
                if (decodedUserInfo.includes(':')) {
                    const [method, password] = decodedUserInfo.split(':');
                    nodeData.method = method;
                    nodeData.password = password;
                }
            }
            // 【事实对齐】彻底删除 SS 不需要的 id 字段
            delete nodeData.id;
        } else {
            // VLESS / Trojan 的身份标识
            nodeData.id = u.username || params.id || "";
            nodeData.password = u.username || params.password || "";
        }

        // 端口合法性物理校验
        if (isNaN(nodeData.port) || nodeData.port <= 0) return null;

        return {
            fp: `${protocol}-${nodeData.address}-${nodeData.port}-${nodeData.path}`,
            data: nodeData
        };

    } catch (e) {
        return null;
    }
}
/**
 * 方案 A 逻辑增强：将清洗后的 Candidate 转化为符合 Clash 规范的 YAML 字符串
 * 严格遵守“真实原则”，不擅自合并或删减解析出的字段
 */
function generateClashYaml(nodes) {
    let yaml = "proxies:\n";
    nodes.forEach((n) => {
        const name = `Node-${n.index}`; // 保持索引一致性
        if (n.type === 'VMESS') {
            yaml += `  - {name: "${name}", type: vmess, server: ${n.address}, port: ${n.port}, uuid: ${n.id}, alterId: ${n.aid}, cipher: auto, network: ${n.net}, ws-opts: {path: ${n.path}}, tls: ${n.tls?true:false}, skip-cert-verify: true, sni: ${n.sni}}\n`;
        } else if (n.type === 'SS') {
            yaml += `  - {name: "${name}", type: ss, server: ${n.address}, port: ${n.port}, cipher: ${n.method}, password: ${n.password}}\n`;
        } else if (n.type === 'VLESS') {
            yaml += `  - {name: "${name}", type: vless, server: ${n.address}, port: ${n.port}, uuid: ${n.id}, cipher: auto, network: ${n.net}, tls: ${n.security==='tls'?true:false}, skip-cert-verify: true, grpc-opts: {grpc-service-name: ""}}\n`;
        } else if (n.type === 'TROJAN') {
            yaml += `  - {name: "${name}", type: trojan, server: ${n.address}, port: ${n.port}, password: ${n.password}, sni: ${n.sni}, skip-cert-verify: true}\n`;
        }
    });
    
    // 注入基础分流配置，防止生成的 YAML 无法直接被客户端识别
    yaml += "\nproxy-groups:\n  - {name: \"🚀 节点选择\", type: select, proxies: [\"DIRECT\"]}\n";
    yaml += "rules:\n  - MATCH,DIRECT\n";
    return yaml;
}

/**
 * 核心运行函数：Nexus-V2.2 逻辑闭环
 */
async function run() {
    console.log("🚀 [小七] 启动云端自适应清洗引擎...");
    
    if (!fs.existsSync(MEET_DIR)) {
        console.log("📂 未发现 Meet 目录，正在创建...");
        fs.mkdirSync(MEET_DIR);
    }
    
    const nodesMap = new Map();
    const files = fs.readdirSync(MEET_DIR).filter(f => f.endsWith('.txt'));
    
    let rawTotal = 0;
    console.log(`📂 发现待处理生肉文件: ${files.length} 个`);

    for (const file of files) {
        const filePath = path.join(MEET_DIR, file);
        const content = fs.readFileSync(filePath, 'utf8');
        let effective = content;

        // 【事实还原】处理某些订阅源整体 Base64 包装的特殊情况
        if (!content.includes('://') && content.length > 50) {
            effective = safeBase64Decode(content);
        }

        const lines = effective.split(/\r?\n/).filter(l => l.includes('://'));
        rawTotal += lines.length;
        
        lines.forEach(line => {
            const res = parseProtocolLink(line.trim());
            if (res && res.data.address) {
                // 【物理切除】剔除广告位与无效节点
                if (res.data.address.includes('更新') || 
                    res.data.address.includes('订阅') || 
                    res.data.address.includes('127.0.0.1')) return;
                
                // 【指纹去重】保持 FP (Fingerprint) 逻辑不变
                nodesMap.set(res.fp, res.data);
            }
        });
        console.log(`📑 正在炼化 [${file}]: 识别 ${lines.length} 条，库中已有去泥节点 ${nodesMap.size} 个`);
    }

    // 重新排序并注入索引，生成真本数据
    const finalNodes = Array.from(nodesMap.values()).map((n, i) => {
        n.index = i + 1;
        return n;
    });

    // 1. 生成原始 JSON 真本 (Candidate.json)
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(finalNodes, null, 2));
    console.log(`\n✨ 阶段 1 完成：原始真本已存入 ${OUTPUT_FILE}`);

    // 2. 生成云端适配 YAML (Candidate_config.yaml)
    const yamlContent = generateClashYaml(finalNodes);
    fs.writeFileSync(YAML_OUTPUT_FILE, yamlContent);
    console.log(`✨ 阶段 2 完成：云端适配版已存入 ${YAML_OUTPUT_FILE}`);

    console.log(`\n🎉 炼化总结：`);
    console.log(`   - 原始总量：${rawTotal}`);
    console.log(`   - 最终精锐：${finalNodes.length}`);
    console.log(`   - 压缩比例：${((finalNodes.length / rawTotal) * 100).toFixed(2)}%`);
}

// 错误捕获自证
run().catch(err => {
    console.error("🔥 运行过程中引擎受损:", err);
    process.exit(1);
});
