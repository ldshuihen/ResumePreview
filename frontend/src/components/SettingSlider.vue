<template>
  <div class="setting-slider">
    <div class="slider-head">
      <label class="field-label">{{ label }}</label>
      <div class="slider-value">
        <input
          type="number"
          :min="min"
          :max="max"
          :step="step"
          :value="modelValue"
          :aria-label="label"
          @change="onInput($event.target.value)"
        />
        <span v-if="unit" class="slider-unit">{{ unit }}</span>
      </div>
    </div>
    <input
      type="range"
      class="range"
      :min="min"
      :max="max"
      :step="step"
      :value="modelValue"
      :aria-label="label"
      :style="{ '--pct': `${percent}%` }"
      @input="onInput($event.target.value)"
    />
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  label: { type: String, required: true },
  modelValue: { type: Number, required: true },
  min: { type: Number, required: true },
  max: { type: Number, required: true },
  step: { type: Number, default: 1 },
  unit: { type: String, default: '' }
})

const emit = defineEmits(['update:modelValue'])

const percent = computed(() => {
  const range = props.max - props.min
  if (range <= 0) return 0
  return Math.min(100, Math.max(0, ((props.modelValue - props.min) / range) * 100))
})

function onInput(raw) {
  const n = Number(raw)
  if (Number.isNaN(n)) return
  emit('update:modelValue', Math.min(props.max, Math.max(props.min, n)))
}
</script>

