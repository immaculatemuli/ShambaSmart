import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
import { t } from './i18n';

/** A photo ready to check: base64 JPEG for the server, uri to show it on screen. */
export type CropPhoto = { base64: string; uri: string };

// Big enough for the AI model to see spots and insects, small enough (about 200-400 KB) for a slow rural network.
const LONG_SIDE = 1280;

async function shrink(asset: ImagePicker.ImagePickerAsset): Promise<CropPhoto> {
  const wide = (asset.width ?? 0) >= (asset.height ?? 0);
  const size = wide ? { width: Math.min(asset.width || LONG_SIDE, LONG_SIDE) } : { height: Math.min(asset.height || LONG_SIDE, LONG_SIDE) };
  const image = await ImageManipulator.manipulate(asset.uri).resize(size).renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.7, base64: true });
  if (!saved.base64) throw new Error('no photo data');
  // The web gives a full data: address; the server wants only the base64 part.
  return { base64: saved.base64.replace(/^data:image\/\w+;base64,/, ''), uri: saved.uri };
}

/** Takes a photo with the camera (on the web: the browser's file or camera picker). Null when cancelled. */
export async function takePhoto(): Promise<CropPhoto | null> {
  if (Platform.OS !== 'web') {
    const { granted } = await ImagePicker.requestCameraPermissionsAsync();
    if (!granted) throw new Error(t('Allow ShambaSmart to use the camera in your phone settings, or choose a photo from the gallery.'));
  }
  const result = await ImagePicker.launchCameraAsync({ mediaTypes: 'images', quality: 1 });
  return result.canceled || !result.assets[0] ? null : shrink(result.assets[0]);
}

export async function choosePhoto(): Promise<CropPhoto | null> {
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 1 });
  return result.canceled || !result.assets[0] ? null : shrink(result.assets[0]);
}
