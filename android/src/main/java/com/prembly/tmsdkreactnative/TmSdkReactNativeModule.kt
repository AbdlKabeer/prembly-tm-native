package com.prembly.tmsdkreactnative

import com.facebook.react.bridge.ReactApplicationContext

class TmSdkReactNativeModule(reactContext: ReactApplicationContext) :
  NativeTmSdkReactNativeSpec(reactContext) {

  override fun multiply(a: Double, b: Double): Double {
    return a * b
  }

  companion object {
    const val NAME = NativeTmSdkReactNativeSpec.NAME
  }
}
