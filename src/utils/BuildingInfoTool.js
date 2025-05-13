export class BuildingInfoTool {
    constructor(viewer) {
        this.viewer = viewer;
        this.nameOverlay = null;
        this.selected = {
            feature: undefined,
            originalColor: new Cesium.Color()
        };
        this.highlighted = {
            feature: undefined,
            originalColor: new Cesium.Color()
        };

        // 创建信息显示overlay
        this.createOverlay();

        // 初始化后处理效果
        this.initPostProcessing();

        // 设置事件处理
        this.setupEventHandlers();
    }

    createOverlay() {
        // 创建信息显示overlay
        this.nameOverlay = document.createElement("div");
        this.viewer.container.appendChild(this.nameOverlay);
        this.nameOverlay.className = "building-info-overlay";
        this.nameOverlay.style.display = "none";
        this.nameOverlay.style.position = "absolute";
        this.nameOverlay.style.bottom = "0";
        this.nameOverlay.style.left = "0";
        this.nameOverlay.style.pointerEvents = "none";
        this.nameOverlay.style.padding = "4px";
        this.nameOverlay.style.backgroundColor = "rgba(0, 0, 0, 0.8)";
        this.nameOverlay.style.color = "white";
        this.nameOverlay.style.borderRadius = "4px";
        this.nameOverlay.style.fontSize = "14px";
        this.nameOverlay.style.maxWidth = "300px";
        this.nameOverlay.style.zIndex = "1000";
    }

    initPostProcessing() {
        if (Cesium.PostProcessStageLibrary.isSilhouetteSupported(this.viewer.scene)) {
            // 创建蓝色轮廓效果（用于悬停）
            this.silhouetteBlue = Cesium.PostProcessStageLibrary.createEdgeDetectionStage();
            this.silhouetteBlue.uniforms.color = Cesium.Color.BLUE;
            this.silhouetteBlue.uniforms.length = 0.01;
            this.silhouetteBlue.selected = [];

            // 创建绿色轮廓效果（用于选中）
            this.silhouetteGreen = Cesium.PostProcessStageLibrary.createEdgeDetectionStage();
            this.silhouetteGreen.uniforms.color = Cesium.Color.LIME;
            this.silhouetteGreen.uniforms.length = 0.01;
            this.silhouetteGreen.selected = [];

            // 添加后处理效果
            this.viewer.scene.postProcessStages.add(
                Cesium.PostProcessStageLibrary.createSilhouetteStage([
                    this.silhouetteBlue,
                    this.silhouetteGreen
                ])
            );
        }
    }

    setupEventHandlers() {
        // 处理鼠标移动事件
        this.viewer.screenSpaceEventHandler.setInputAction(
            (movement) => {
                this.handleMouseMove(movement);
            },
            Cesium.ScreenSpaceEventType.MOUSE_MOVE
        );

        // 处理鼠标点击事件
        this.viewer.screenSpaceEventHandler.setInputAction(
            (movement) => {
                this.handleClick(movement);
            },
            Cesium.ScreenSpaceEventType.LEFT_CLICK
        );
    }

    handleMouseMove(movement) {
        // 清除之前的高亮
        if (Cesium.defined(this.silhouetteBlue)) {
            this.silhouetteBlue.selected = [];
        }

        // 获取当前鼠标位置下的要素
        const pickedFeature = this.viewer.scene.pick(movement.endPosition);

        // 更新信息显示
        this.updateOverlay(pickedFeature, movement.endPosition);

        if (!Cesium.defined(pickedFeature)) {
            return;
        }

        // 如果支持轮廓效果，添加轮廓高亮
        if (Cesium.defined(this.silhouetteBlue) && pickedFeature !== this.selected.feature) {
            this.silhouetteBlue.selected = [pickedFeature];
        }
    }

    handleClick(movement) {
        // 清除之前的选中状态
        if (Cesium.defined(this.silhouetteGreen)) {
            this.silhouetteGreen.selected = [];
        }

        // 获取点击位置的要素
        const pickedFeature = this.viewer.scene.pick(movement.position);
        if (!Cesium.defined(pickedFeature)) {
            return;
        }

        // 更新选中状态
        if (Cesium.defined(this.silhouetteGreen)) {
            this.silhouetteGreen.selected = [pickedFeature];
        }

        // 显示详细信息
        this.showFeatureInfo(pickedFeature);
    }

    updateOverlay(pickedFeature, position) {
        if (!Cesium.defined(pickedFeature)) {
            this.nameOverlay.style.display = "none";
            return;
        }

        // 显示基本信息
        this.nameOverlay.style.display = "block";
        this.nameOverlay.style.bottom = `${this.viewer.canvas.clientHeight - position.y}px`;
        this.nameOverlay.style.left = `${position.x}px`;

        // 获取并显示要素信息
        const properties = this.getFeatureProperties(pickedFeature);
        this.nameOverlay.innerHTML = this.formatBasicInfo(properties);
    }

    showFeatureInfo(feature) {
        if (!Cesium.defined(feature)) return;

        // 获取要素属性
        const properties = this.getFeatureProperties(feature);

        // 创建详细信息HTML
        const description = this.createDetailedInfo(properties);

        // 创建一个实体来显示信息框
        const entity = new Cesium.Entity();
        entity.description = description;
        this.viewer.selectedEntity = entity;
    }

    getFeatureProperties(feature) {
        const properties = {};

        // 尝试获取常见的属性
        if (feature.getProperty) {
            const propertyNames = feature.getPropertyNames?.() || [];
            propertyNames.forEach(name => {
                properties[name] = feature.getProperty(name);
            });
        } else if (feature.primitive && feature.primitive.properties) {
            // 处理primitive的属性
            const primitive = feature.primitive;
            Object.keys(primitive.properties).forEach(key => {
                properties[key] = primitive.properties[key];
            });
        }

        // 获取位置信息
        if (feature.primitive && feature.primitive.boundingSphere) {
            const center = feature.primitive.boundingSphere.center;
            const cartographic = Cesium.Cartographic.fromCartesian(center);
            properties.longitude = Cesium.Math.toDegrees(cartographic.longitude);
            properties.latitude = Cesium.Math.toDegrees(cartographic.latitude);
            properties.height = cartographic.height;
        }

        return properties;
    }

    formatBasicInfo(properties) {
        let info = '';

        // 优先显示名称、ID等标识性信息
        const identifiers = ['name', 'id', 'title', 'type'];
        for (const key of identifiers) {
            if (properties[key]) {
                info += `${properties[key]}<br>`;
                break;
            }
        }

        // 如果有高度信息，显示高度
        if (properties.height !== undefined) {
            info += `高度: ${properties.height.toFixed(2)}米`;
        }

        return info;
    }

    createDetailedInfo(properties) {
        let html = '<table class="cesium-infoBox-defaultTable"><tbody>';

        // 添加所有可用属性
        Object.entries(properties).forEach(([key, value]) => {
            // 跳过null或undefined的值
            if (value == null) return;

            // 格式化数值
            let formattedValue = value;
            if (typeof value === 'number') {
                formattedValue = value.toFixed(6);
            }

            html += `
        <tr>
          <th>${key}</th>
          <td>${formattedValue}</td>
        </tr>
      `;
        });

        html += '</tbody></table>';
        return html;
    }

    destroy() {
        // 清理事件监听
        this.viewer.screenSpaceEventHandler.removeInputAction(
            Cesium.ScreenSpaceEventType.MOUSE_MOVE
        );
        this.viewer.screenSpaceEventHandler.removeInputAction(
            Cesium.ScreenSpaceEventType.LEFT_CLICK
        );

        // 移除overlay
        if (this.nameOverlay && this.nameOverlay.parentNode) {
            this.nameOverlay.parentNode.removeChild(this.nameOverlay);
        }

        // 清理后处理效果
        if (this.silhouetteBlue) {
            this.silhouetteBlue.selected = [];
        }
        if (this.silhouetteGreen) {
            this.silhouetteGreen.selected = [];
        }
    }
} 