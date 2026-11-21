<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { drawDie, type VisualDie } from '../tabletop/dice-visuals'

const props=defineProps<{ dice:VisualDie[] }>()
const canvas=ref<HTMLCanvasElement>()
const visibleDice=computed(()=>props.dice.slice(0,30))
const remaining=computed(()=>props.dice.length-visibleDice.value.length)
let frame=0

watch(canvas,element=>{
  if (!element) return
  const context=element.getContext('2d')
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const start=performance.now()
  const duration=reduced?0:1000+((Math.min(visibleDice.value.length,6)-1)*35)
  function paint(now:number) {
    const width=element!.clientWidth
    const cell=Math.min(68,Math.max(40,Math.floor(width/5)))
    const columns=Math.min(visibleDice.value.length,Math.max(1,Math.floor(width/cell)))
    const rows=Math.ceil(visibleDice.value.length/columns)
    const height=rows*cell
    const dpr=Math.min(window.devicePixelRatio||1,2)
    const pixelWidth=Math.round(width*dpr),pixelHeight=Math.round(height*dpr)
    if (element!.width!==pixelWidth||element!.height!==pixelHeight){
      element!.width=pixelWidth
      element!.height=pixelHeight
      element!.style.height=`${height}px`
    }
    context?.setTransform(dpr,0,0,dpr,0,0)
    context?.clearRect(0,0,width,height)
    if(context)for(const [index,die] of visibleDice.value.entries()){
      const column=index%columns,row=Math.floor(index/columns)
      const rowLength=Math.min(columns,visibleDice.value.length-row*columns)
      const progress=reduced?1:Math.min(1,Math.max(0,(now-start-(index%6)*35)/1000))
      const bounce=(1-progress)*Math.abs(Math.sin(progress*12))*cell*.22
      const x=width/2+(column-(rowLength-1)/2)*cell
      const y=(row+.45)*cell-bounce
      drawDie(context,die,x,y,cell*.32,progress,index)
      context.fillStyle='#f2deff'
      context.textAlign='center'
      context.textBaseline='middle'
      context.font='600 10px system-ui'
      context.fillText(`d${die.sides}`,x,(row+.91)*cell)
    }
    if(now-start<duration)frame=requestAnimationFrame(paint)
  }
  frame=requestAnimationFrame(paint)
},{flush:'post'})
onBeforeUnmount(()=>cancelAnimationFrame(frame))
</script>

<template>
  <Teleport to="body">
    <aside class="dice-overlay" aria-hidden="true">
      <canvas ref="canvas" data-dice-animation />
      <span v-if="remaining">+{{ remaining }} dados no chat</span>
    </aside>
  </Teleport>
</template>

<style scoped>
.dice-overlay {
  position:fixed; z-index:7000; top:clamp(65px,12vh,115px); left:50%; transform:translateX(-50%);
  pointer-events:none; width:min(560px,92vw); text-align:center; color:#f2deff;
  filter:drop-shadow(0 4px 6px #0d0819);
}
canvas { display:block; width:100%; }
span { display:inline-block; padding:3px 10px; border-radius:8px; background:#21182c; font-size:12px; }
</style>
