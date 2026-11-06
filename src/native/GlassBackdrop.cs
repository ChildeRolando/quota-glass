using System;
using System.Numerics;
using System.Runtime.InteropServices;
using System.Windows.Forms;
using Windows.UI.Composition;
using Windows.UI.Composition.Desktop;

// A host-backdrop visual with its OWN rounded geometric clip. No full-HWND Accent material.
class GlassBackdrop {
 [StructLayout(LayoutKind.Sequential)] struct Rect {public int L,T,R,B;}
 [StructLayout(LayoutKind.Sequential)] struct QueueOptions {public int Size,Thread,Apartment;}
 [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)] struct WindowClass {public uint Size,Style;public WndProc Proc;public int ClsExtra,WndExtra;public IntPtr Instance,Icon,Cursor,Background;public string Menu,Name;public IntPtr SmallIcon;}
 delegate IntPtr WndProc(IntPtr h,uint m,IntPtr w,IntPtr l);
 [ComImport,Guid("29E691FA-4567-4DCA-B319-D0F207EB6807"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] interface DesktopInterop {void CreateDesktopWindowTarget(IntPtr hwnd,[MarshalAs(UnmanagedType.Bool)] bool topmost,out IntPtr result);}
 [DllImport("coremessaging.dll")] static extern int CreateDispatcherQueueController(QueueOptions options,[MarshalAs(UnmanagedType.IUnknown)]out object controller);
 [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr h,out Rect r);
 [DllImport("user32.dll")] static extern bool IsWindow(IntPtr h);
 [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
 [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h,out uint p);
 [DllImport("user32.dll")] static extern IntPtr GetWindow(IntPtr h,uint command);
 [DllImport("user32.dll")] static extern bool SetWindowPos(IntPtr h,IntPtr after,int x,int y,int width,int height,uint flags);
 [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr h,int command);
 [DllImport("user32.dll")] static extern bool DestroyWindow(IntPtr h);
 [DllImport("user32.dll")] static extern bool SetProcessDpiAwarenessContext(IntPtr context);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern ushort RegisterClassEx(ref WindowClass c);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern IntPtr CreateWindowEx(int ex,string cls,string title,int style,int x,int y,int width,int height,IntPtr parent,IntPtr menu,IntPtr instance,IntPtr param);
 [DllImport("user32.dll")] static extern IntPtr DefWindowProc(IntPtr h,uint m,IntPtr w,IntPtr l);
 [DllImport("kernel32.dll")] static extern IntPtr GetModuleHandle(string name);
 [DllImport("dwmapi.dll")] static extern int DwmSetWindowAttribute(IntPtr h,int attr,ref int value,int size);
 static WndProc procedure=WindowProcedure;
 static IntPtr target,host; static uint owner;static object queue;
 static Compositor compositor;static DesktopWindowTarget compositionTarget;
 static SpriteVisual glass;static CompositionRoundedRectangleGeometry shape;
 static Rect previous;static bool shown;
 static IntPtr WindowProcedure(IntPtr h,uint m,IntPtr w,IntPtr l){if(m==0x14)return new IntPtr(1);if(m==0x84)return new IntPtr(-1);if(m==0x21)return new IntPtr(3);return DefWindowProc(h,m,w,l);}
 [STAThread] static int Main(string[] args){
  try {
   if(args.Length!=2)return 2;target=new IntPtr(long.Parse(args[0]));owner=uint.Parse(args[1]);
   uint actual;GetWindowThreadProcessId(target,out actual);if(actual!=owner)return 3;
   SetProcessDpiAwarenessContext(new IntPtr(-4));
   Marshal.ThrowExceptionForHR(CreateDispatcherQueueController(new QueueOptions{Size=12,Thread=2,Apartment=2},out queue));
   var wc=new WindowClass{Size=(uint)Marshal.SizeOf(typeof(WindowClass)),Proc=procedure,Instance=GetModuleHandle(null),Name="QuotaGlassBackdrop"};
   RegisterClassEx(ref wc);
   host=CreateWindowEx(0x00200000|0x08000000|0x80|0x20,wc.Name,"Quota Glass Backdrop",unchecked((int)0x80000000),0,0,100,100,IntPtr.Zero,IntPtr.Zero,wc.Instance,IntPtr.Zero);
   if(host==IntPtr.Zero)return 4;
   int yes=1,noBorder=unchecked((int)0xfffffffe),noCorner=1,noBackdrop=1;
   DwmSetWindowAttribute(host,17,ref yes,4);DwmSetWindowAttribute(host,34,ref noBorder,4);
   DwmSetWindowAttribute(host,33,ref noCorner,4);DwmSetWindowAttribute(host,38,ref noBackdrop,4);
   compositor=new Compositor();IntPtr raw;
   ((DesktopInterop)(object)compositor).CreateDesktopWindowTarget(host,true,out raw);
   compositionTarget=(DesktopWindowTarget)Marshal.GetObjectForIUnknown(raw);Marshal.Release(raw);
   glass=compositor.CreateSpriteVisual();glass.Brush=compositor.CreateHostBackdropBrush();glass.Opacity=0.28f;
   shape=compositor.CreateRoundedRectangleGeometry();glass.Clip=compositor.CreateGeometricClip(shape);
   compositionTarget.Root=glass;
   var timer=new Timer();timer.Interval=16;timer.Tick+=delegate{Sync();};timer.Start();Sync();
   Application.Run();timer.Stop();DestroyWindow(host);GC.KeepAlive(queue);return 0;
  }catch(Exception e){Console.Error.WriteLine("Backdrop initialization failed: "+e.GetType().Name+" "+e.HResult.ToString("X"));return 1;}
 }
 static void Sync(){
  uint actual;GetWindowThreadProcessId(target,out actual);
  if(!IsWindow(target)||actual!=owner){Application.ExitThread();return;}
  if(!IsWindowVisible(target)){if(shown){ShowWindow(host,0);shown=false;}return;}
  Rect r;if(!GetWindowRect(target,out r))return;
  bool changed=r.L!=previous.L||r.T!=previous.T||r.R!=previous.R||r.B!=previous.B;
  if(changed){float w=r.R-r.L,h=r.B-r.T;glass.Size=new Vector2(w,h);shape.Size=glass.Size;shape.CornerRadius=new Vector2(h*76f/414f);previous=r;}
  if(changed||!shown||GetWindow(target,2)!=host){SetWindowPos(host,target,r.L,r.T,r.R-r.L,r.B-r.T,0x10|0x40);shown=true;}
 }
}
