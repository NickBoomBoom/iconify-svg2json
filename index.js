import { promises as fs } from "fs";
import { importDirectory } from "@iconify/tools/lib/import/directory";
import { cleanupSVG } from "@iconify/tools/lib/svg/cleanup";
import { runSVGO } from "@iconify/tools/lib/optimise/svgo";
import { parseColors, isEmptyColor } from "@iconify/tools/lib/colors/parse";

(async () => {
  try {
    // 1. 导入目录中的SVG文件
    const iconSet = await importDirectory("svg/custom", {
      prefix: "custom", // 自定义图标集前缀
    });

    // 2. 遍历处理每个图标
    iconSet.forEachSync((name, type) => {
      // 只处理图标类型，跳过别名/元数据
      if (type !== "icon") return;

      // 获取SVG对象
      const svg = iconSet.toSVG(name);
      if (!svg) {
        iconSet.remove(name);
        console.warn(`🚨 无效图标已移除: ${name}`);
        return;
      }

      try {
        // 3. 清理SVG
        cleanupSVG(svg, {
          // 高级清理配置
          removeXMLNS: true,          // 移除冗余命名空间
          removeUnusedNS: true,       // 移除未使用的命名空间
          convertShapeToPath: true,  // 将基本图形转为路径
        });

        // 4. 颜色处理
        parseColors(svg, {
          defaultColor: "currentColor",
          callback: (attr, colorStr, color) => {
            // 保留透明颜色，其他颜色替换为 currentColor
            return !color || isEmptyColor(color) ? colorStr : "currentColor";
          },
        });

        // 5. 使用SVGO优化
        runSVGO(svg, {
          // 自定义SVGO配置
          plugins: [
            "preset-default",         // 使用默认预设
            { name: "removeViewBox", active: false }, // 保留viewBox
            { name: "sortAttrs", active: true },      // 属性排序
          ],
        });

        // 更新处理后的SVG
        iconSet.fromSVG(name, svg);
      } catch (err) {
        console.error(`处理失败 ${name}:`, err);
        iconSet.remove(name);
      }
    });

    // 6. 准备导出数据
    const exportData = iconSet.export();
    
    //TODO: 添加元数据 (可选)
    // exportData.info = {
    //   author: "Your Name",
    //   license: "MIT",
    //   version: "1.0.0",
    // };

    // 7. 生成格式化JSON
    const jsonOutput = JSON.stringify(exportData, null, 2) + "\n";

    // 8. 确保输出目录存在
    await fs.mkdir("output", { recursive: true });
    
    // 9. 写入文件
    const outputPath = `output/${iconSet.prefix}.json`;
    await fs.writeFile(outputPath, jsonOutput, "utf8");
    
    console.log(`✅ 成功导出 ${iconSet.count()} 个图标至 ${outputPath}`);
  } catch (err) {
    console.error("❌ 处理流程出错:", err);
    process.exit(1);
  }
})();